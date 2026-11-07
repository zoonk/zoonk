import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { bearer } from "better-auth/plugins";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BETTER_AUTH_BASE_PATH } from "../config";
import { linkGuestAccount } from "../guests/link-guest-account";
import { issueAppChallenge } from "../request-guards/app-challenge";
import {
  type RestoreKeyAuthenticator,
  makeAssertionJson,
  makeRegistrationJson,
  makeRestoreKey,
  makeSigningCertificate,
} from "../restore-keys/_test-utils/restore-key-authenticator";
import { baseAuthConfig, baseAuthPlugins } from "../server";
import { guestPlugin } from "./guest";
import { restoreKeyPlugin } from "./restore-key";

const ORIGIN = "http://localhost:3000";

const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: ORIGIN,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
  },
  plugins: [...baseAuthPlugins, bearer(), guestPlugin(), restoreKeyPlugin()],
  rateLimit: { enabled: false },
  secret: "restore-key-plugin-test-secret-with-enough-entropy",
});

const releaseApp = makeSigningCertificate();
const debugApp = makeSigningCertificate();

async function post({ body, path, token }: { body: unknown; path: string; token?: string }) {
  const headers = new Headers({ "content-type": "application/json" });

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await auth.handler(
    new Request(`${ORIGIN}${BETTER_AUTH_BASE_PATH}${path}`, {
      body: JSON.stringify(body),
      headers,
      method: "POST",
    }),
  );

  const json: unknown = await response.json().catch(() => null);
  return { body: json, status: response.status };
}

async function signUp() {
  const { body } = await post({
    body: {
      email: `restore-key-${randomUUID()}@example.test`,
      name: "Restore",
      password: "restore-key-password",
    },
    path: "/sign-up/email",
  });

  return readSession(body);
}

async function signInAsGuest() {
  const { body } = await post({ body: {}, path: "/sign-in/anonymous" });
  return readSession(body);
}

function readSession(body: unknown) {
  const { token, user } = body as { token: string; user: { id: string } };
  return { token, userId: user.id };
}

async function register({
  key,
  origin = releaseApp.origin,
  rpId,
  token,
}: {
  key: RestoreKeyAuthenticator;
  origin?: string;
  rpId?: string;
  token: string;
}) {
  const challenge = await issueAppChallenge();

  return post({
    body: { registrationResponseJson: makeRegistrationJson({ challenge, key, origin, rpId }) },
    path: "/restore-key/register",
    token,
  });
}

async function redeem({
  challenge,
  key,
  origin = releaseApp.origin,
  rpId,
  signer,
}: {
  challenge?: string;
  key: RestoreKeyAuthenticator;
  origin?: string;
  rpId?: string;
  signer?: RestoreKeyAuthenticator;
}) {
  const authenticationResponseJson = makeAssertionJson({
    challenge: challenge ?? (await issueAppChallenge()),
    key,
    origin,
    rpId,
    signer,
  });

  return post({ body: { authenticationResponseJson }, path: "/restore-key/session" });
}

async function readSessionUser(token: string) {
  const session = await prisma.session.findUnique({ select: { userId: true }, where: { token } });
  return session?.userId;
}

async function registeredKey({
  algorithm,
  session,
}: {
  algorithm?: RestoreKeyAuthenticator["algorithm"];
  session: { token: string };
}) {
  const key = makeRestoreKey(algorithm);
  const registered = await register({ key, token: session.token });

  expect(registered.status).toBe(200);

  return key;
}

const keyInvalid = { body: expect.objectContaining({ code: "RESTORE_KEY_INVALID" }), status: 401 };

const challengeInvalid = {
  body: expect.objectContaining({ code: "RESTORE_KEY_CHALLENGE_INVALID" }),
  status: 400,
};

describe(restoreKeyPlugin, () => {
  beforeEach(() => {
    vi.stubEnv(
      "ANDROID_RELEASE_CERT_FINGERPRINTS",
      `${makeSigningCertificate().fingerprint}, ${releaseApp.fingerprint}`,
    );

    vi.stubEnv("ANDROID_DEBUG_CERT_FINGERPRINTS", debugApp.fingerprint);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("binds a key to the session that registered it and signs a new phone in as that learner", async () => {
    const session = await signUp();
    const key = await registeredKey({ session });
    const registering = await prisma.session.findUniqueOrThrow({ where: { token: session.token } });

    await expect(prisma.restoreKey.findUnique({ where: { id: key.id } })).resolves.toMatchObject({
      sessionId: registering.id,
    });

    const restored = await redeem({ key });

    expect(restored).toStrictEqual({
      body: { isGuest: false, token: expect.any(String) },
      status: 200,
    });

    const { token } = restored.body as { token: string };

    expect(token).not.toBe(session.token);
    await expect(readSessionUser(token)).resolves.toBe(session.userId);
    await expect(readSessionUser(session.token)).resolves.toBe(session.userId);
  });

  it("restores a guest as a guest, with an RS256 key from the debug build", async () => {
    const guest = await signInAsGuest();
    const key = makeRestoreKey("RS256");

    await expect(
      register({ key, origin: debugApp.origin, token: guest.token }),
    ).resolves.toMatchObject({ status: 200 });

    const restored = await redeem({ key, origin: debugApp.origin });

    expect(restored).toMatchObject({ body: { isGuest: true }, status: 200 });

    await expect(readSessionUser((restored.body as { token: string }).token)).resolves.toBe(
      guest.userId,
    );
  });

  it("keeps a key bound to its first session when it's registered again", async () => {
    const [owner, other] = await Promise.all([signUp(), signUp()]);
    const key = await registeredKey({ session: owner });

    await expect(register({ key, token: owner.token })).resolves.toMatchObject({ status: 200 });

    const impostor = { ...makeRestoreKey(), id: key.id };

    await expect(register({ key: impostor, token: other.token })).resolves.toMatchObject({
      body: { code: "RESTORE_KEY_REGISTRATION_INVALID" },
      status: 400,
    });

    const restored = await redeem({ key });

    await expect(readSessionUser((restored.body as { token: string }).token)).resolves.toBe(
      owner.userId,
    );
  });

  it("refuses a registration without a session, from another app or for another RP ID", async () => {
    const session = await signUp();
    const key = makeRestoreKey();

    await expect(register({ key, token: "not-a-session" })).resolves.toMatchObject({ status: 401 });

    await expect(
      register({ key, origin: makeSigningCertificate().origin, token: session.token }),
    ).resolves.toMatchObject({ body: { code: "RESTORE_KEY_REGISTRATION_INVALID" }, status: 400 });

    await expect(register({ key, rpId: "zoonk.com", token: session.token })).resolves.toMatchObject(
      { body: { code: "RESTORE_KEY_REGISTRATION_INVALID" }, status: 400 },
    );

    await expect(prisma.restoreKey.findUnique({ where: { id: key.id } })).resolves.toBeNull();
  });

  it("answers 400 for a spent, expired or unknown challenge and keeps the key working", async () => {
    const key = await registeredKey({ session: await signUp() });

    const spent = await issueAppChallenge();
    await expect(redeem({ challenge: spent, key })).resolves.toMatchObject({ status: 200 });

    const expired = await issueAppChallenge();

    await prisma.verification.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
      where: { identifier: `app-attest-challenge:${expired}` },
    });

    const refusals = await Promise.all(
      [spent, expired, "never-issued"].map((challenge) => redeem({ challenge, key })),
    );

    expect(refusals).toStrictEqual([challengeInvalid, challengeInvalid, challengeInvalid]);

    await expect(redeem({ key })).resolves.toMatchObject({ status: 200 });
  });

  it("answers 400 for a body that isn't a credential response", async () => {
    await expect(
      post({ body: { authenticationResponseJson: "{" }, path: "/restore-key/session" }),
    ).resolves.toMatchObject({ body: { code: "RESTORE_KEY_RESPONSE_MALFORMED" }, status: 400 });
  });

  it("answers 401 when the signature, origin, RP ID or key is wrong", async () => {
    const key = await registeredKey({ session: await signUp() });

    const refusals = await Promise.all([
      redeem({ key, signer: makeRestoreKey() }),
      redeem({ key, origin: makeSigningCertificate().origin }),
      redeem({ key, rpId: "zoonk.com" }),
      redeem({ key: makeRestoreKey() }),
    ]);

    expect(refusals).toStrictEqual([keyInvalid, keyInvalid, keyInvalid, keyInvalid]);
  });

  it("answers 401 once the registering session signed out or expired", async () => {
    const [signedOut, expired] = await Promise.all([signUp(), signUp()]);

    const [signedOutKey, expiredKey] = await Promise.all([
      registeredKey({ session: signedOut }),
      registeredKey({ session: expired }),
    ]);

    await post({ body: {}, path: "/sign-out", token: signedOut.token });

    await prisma.session.update({
      data: { expiresAt: new Date(Date.now() - 1000) },
      where: { token: expired.token },
    });

    await expect(
      Promise.all([redeem({ key: signedOutKey }), redeem({ key: expiredKey })]),
    ).resolves.toStrictEqual([keyInvalid, keyInvalid]);
  });

  it("answers 401 once the account is deleted or the guest became an account", async () => {
    const [deleted, guest, account] = await Promise.all([signUp(), signInAsGuest(), signUp()]);

    const [deletedKey, guestKey] = await Promise.all([
      registeredKey({ session: deleted }),
      registeredKey({ session: guest }),
    ]);

    const context = await auth.$context;
    await context.internalAdapter.deleteUser(deleted.userId);
    await linkGuestAccount({ account: { id: account.userId }, guestUserId: guest.userId });

    await expect(
      Promise.all([redeem({ key: deletedKey }), redeem({ key: guestKey })]),
    ).resolves.toStrictEqual([keyInvalid, keyInvalid]);
  });

  it("answers 403 for a disabled account", async () => {
    const session = await signUp();
    const key = await registeredKey({ session });

    await prisma.user.update({ data: { banned: true }, where: { id: session.userId } });

    await expect(redeem({ key })).resolves.toMatchObject({
      body: { code: "BANNED_USER" },
      status: 403,
    });
  });
});
