import { createHash, randomUUID } from "node:crypto";
import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodePlayIntegrityToken } from "../../../../../../packages/auth/src/play-integrity/decode-play-integrity-token";
import {
  type RestoreKeyAuthenticator,
  makeAssertionJson,
  makeRegistrationJson,
  makeRestoreKey,
  makeSigningCertificate,
} from "../../../../../../packages/auth/src/restore-keys/_test-utils/restore-key-authenticator";
import { POST as createChallenge } from "../app-attest/challenges/route";
import { POST as createRestoreKey } from "./current/restore-keys/route";
import { POST as createRestoreKeySession } from "./restore-key/route";

/** Google decrypts Play Integrity tokens; everything Zoonk checks about the answer stays real. */
vi.mock("../../../../../../packages/auth/src/play-integrity/decode-play-integrity-token", () => ({
  decodePlayIntegrityToken: vi.fn(),
}));

vi.mock("@zoonk/auth", async () => {
  const { createRequire } = await import("node:module");
  /** Better Auth belongs to the auth workspace; don't add it to API just for this harness. */
  const authRequire = createRequire(
    new URL("../../../../../../packages/auth/package.json", import.meta.url),
  );

  const { betterAuth } = await import(authRequire.resolve("better-auth/minimal"));
  const { bearer } = await import(authRequire.resolve("better-auth/plugins"));

  const { baseAuthConfig, baseAuthPlugins } =
    await import("../../../../../../packages/auth/src/server");

  const { appAttestPlugin } =
    await import("../../../../../../packages/auth/src/plugins/app-attest");

  const { guestPlugin } = await import("../../../../../../packages/auth/src/plugins/guest");

  const { restoreKeyPlugin } =
    await import("../../../../../../packages/auth/src/plugins/restore-key");

  return {
    auth: betterAuth({
      ...baseAuthConfig,
      plugins: [...baseAuthPlugins, appAttestPlugin(), bearer(), guestPlugin(), restoreKeyPlugin()],
      rateLimit: { enabled: false },
      secret: "restore-key-api-test-secret-with-enough-entropy",
    }),
  };
});

const BASE_URL = "http://localhost:9002";
const androidApp = makeSigningCertificate();

function post({
  body,
  headers = new Headers(),
  path,
  token,
}: {
  body: unknown;
  headers?: Headers;
  path: string;
  token?: string;
}) {
  headers.set("content-type", "application/json");

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return new NextRequest(`${BASE_URL}/v1${path}`, {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  });
}

async function issueAppChallenge() {
  const response = await createChallenge(post({ body: {}, path: "/app-attest/challenges" }));
  const { challenge } = (await response.json()) as { challenge: string };

  return challenge;
}

async function register({
  headers,
  key,
  token,
}: {
  headers?: Headers;
  key: RestoreKeyAuthenticator;
  token?: string;
}) {
  const registrationResponseJson = makeRegistrationJson({
    challenge: await issueAppChallenge(),
    key,
    origin: androidApp.origin,
  });

  return createRestoreKey(
    post({
      body: { registrationResponseJson },
      headers,
      path: "/sessions/current/restore-keys",
      token,
    }),
  );
}

/** What the Android app sends: a Play Integrity token whose request hash covers this key's ID. */
async function playIntegrityProof(credentialId: string) {
  const challenge = await issueAppChallenge();
  const clientData = ["zoonk-app-attest:1", challenge, "restore-key", credentialId].join("\n");

  vi.mocked(decodePlayIntegrityToken).mockResolvedValueOnce({
    appIntegrity: { appRecognitionVerdict: "PLAY_RECOGNIZED" },
    deviceIntegrity: { deviceRecognitionVerdict: ["MEETS_DEVICE_INTEGRITY"] },
    requestDetails: {
      requestHash: createHash("sha256").update(clientData).digest("base64url"),
      requestPackageName: "com.zoonk",
    },
  });

  return new Headers({
    "x-play-integrity-challenge": challenge,
    "x-play-integrity-token": `play-integrity-token-${randomUUID()}`,
  });
}

async function redeem({ challenge, key }: { challenge?: string; key: RestoreKeyAuthenticator }) {
  const authenticationResponseJson = makeAssertionJson({
    challenge: challenge ?? (await issueAppChallenge()),
    key,
    origin: androidApp.origin,
  });

  return createRestoreKeySession(
    post({ body: { authenticationResponseJson }, path: "/sessions/restore-key" }),
  );
}

async function guestWithRestoreKey() {
  const guest = await auth.api.signInAnonymous();
  const key = makeRestoreKey();
  const registered = await register({ key, token: guest.token });

  expect(registered.status).toBe(204);

  return { guest, key };
}

describe("restore keys through the API", () => {
  beforeEach(() => {
    vi.stubEnv("ANDROID_RELEASE_CERT_FINGERPRINTS", androidApp.fingerprint);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers a restore key and signs a new phone in as the same learner", async () => {
    const { guest, key } = await guestWithRestoreKey();
    const restored = await redeem({ key });

    expect(restored.status).toBe(200);

    const body: unknown = await restored.json();
    expect(body).toStrictEqual({ isGuest: true, token: expect.any(String) });

    const session = await prisma.session.findUnique({
      where: { token: (body as { token: string }).token },
    });

    expect(session?.userId).toBe(guest.user.id);
  });

  it("answers 401 to a registration without a session", async () => {
    const response = await register({ key: makeRestoreKey() });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("answers 400 for a spent challenge and 401 for a key that can't sign in", async () => {
    const { key } = await guestWithRestoreKey();
    const challenge = await issueAppChallenge();

    const first = await redeem({ challenge, key });

    expect(first.status).toBe(200);

    const replayed = await redeem({ challenge, key });

    expect(replayed.status).toBe(400);

    await expect(replayed.json()).resolves.toMatchObject({
      error: { code: "RESTORE_KEY_CHALLENGE_INVALID" },
    });

    const unknown = await redeem({ key: makeRestoreKey() });

    expect(unknown.status).toBe(401);
    await expect(unknown.json()).resolves.toMatchObject({ error: { code: "RESTORE_KEY_INVALID" } });
  });

  it("refuses a body without the credential response before reaching auth", async () => {
    const response = await createRestoreKeySession(
      post({ body: { authenticationResponseJson: "" }, path: "/sessions/restore-key" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  it("answers 403 for a disabled account", async () => {
    const { guest, key } = await guestWithRestoreKey();
    await prisma.user.update({ data: { banned: true }, where: { id: guest.user.id } });

    const response = await redeem({ key });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "ACCOUNT_DISABLED" } });
  });

  it("registers a key without app proof outside production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const guest = await auth.api.signInAnonymous();

    const response = await register({ key: makeRestoreKey(), token: guest.token });

    expect(response.status).toBe(204);
  });

  it("registers a key in production only with a Play Integrity proof for that key", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.mocked(decodePlayIntegrityToken).mockReset();

    const guest = await auth.api.signInAnonymous();
    const [unproven, otherKey, proven] = [makeRestoreKey(), makeRestoreKey(), makeRestoreKey()];

    const refusals = await Promise.all([
      register({ key: unproven, token: guest.token }),
      register({
        headers: await playIntegrityProof(makeRestoreKey().id),
        key: otherKey,
        token: guest.token,
      }),
    ]);

    expect(refusals.map((refusal) => refusal.status)).toStrictEqual([403, 403]);

    await expect(Promise.all(refusals.map((refusal) => refusal.json()))).resolves.toMatchObject([
      { error: { code: "BOT_DETECTED" } },
      { error: { code: "BOT_DETECTED" } },
    ]);

    const accepted = await register({
      headers: await playIntegrityProof(proven.id),
      key: proven,
      token: guest.token,
    });

    expect(accepted.status).toBe(204);

    await expect(
      prisma.restoreKey.findMany({ where: { id: { in: [unproven.id, otherKey.id, proven.id] } } }),
    ).resolves.toStrictEqual([expect.objectContaining({ id: proven.id })]);
  });
});
