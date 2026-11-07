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

  return registerJson({ json: makeRegistrationJson({ challenge, key, origin, rpId }), token });
}

function registerJson({ json, token }: { json: string; token: string }) {
  return post({ body: { registrationResponseJson: json }, path: "/restore-key/register", token });
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

type AssertionJson = { rawId: string; response: Record<string, string> };

async function redeemTampered({
  key,
  tamper,
}: {
  key: RestoreKeyAuthenticator;
  tamper: (assertion: AssertionJson) => AssertionJson;
}) {
  const assertion = JSON.parse(
    makeAssertionJson({ challenge: await issueAppChallenge(), key, origin: releaseApp.origin }),
  ) as AssertionJson;

  return post({
    body: { authenticationResponseJson: JSON.stringify(tamper(assertion)) },
    path: "/restore-key/session",
  });
}

function withResponse(assertion: AssertionJson, fields: Record<string, string>) {
  return { ...assertion, response: { ...assertion.response, ...fields } };
}

function rewriteClientData(clientDataJSON: string | undefined, fields: Record<string, string>) {
  const clientData = JSON.parse(Buffer.from(clientDataJSON ?? "", "base64url").toString("utf8"));
  return Buffer.from(JSON.stringify({ ...clientData, ...fields })).toString("base64url");
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
  const key = makeRestoreKey({ algorithm });
  const registered = await register({ key, token: session.token });

  expect(registered.status).toBe(200);

  return key;
}

const keyInvalid = { body: expect.objectContaining({ code: "RESTORE_KEY_INVALID" }), status: 401 };

const responseMalformed = {
  body: expect.objectContaining({ code: "RESTORE_KEY_RESPONSE_MALFORMED" }),
  status: 400,
};

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
    const key = makeRestoreKey({ algorithm: "RS256" });

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

  it("answers 400 for a malformed assertion and keeps the key working", async () => {
    const key = await registeredKey({ session: await signUp() });

    const refusals = await Promise.all([
      post({ body: { authenticationResponseJson: "{" }, path: "/restore-key/session" }),
      redeemTampered({
        key,
        tamper: (assertion) => withResponse(assertion, { authenticatorData: "AA" }),
      }),
      redeemTampered({
        key,
        tamper: (assertion) => ({ ...assertion, rawId: makeRestoreKey().id }),
      }),
      redeemTampered({
        key,
        tamper: (assertion) =>
          withResponse(assertion, {
            clientDataJSON: rewriteClientData(assertion.response.clientDataJSON, {
              type: "webauthn.create",
            }),
          }),
      }),
      redeemTampered({
        key,
        tamper: (assertion) =>
          withResponse(assertion, {
            clientDataJSON: rewriteClientData(assertion.response.clientDataJSON, {
              origin: "https://www.zoonk.com/",
            }),
          }),
      }),
    ]);

    expect(refusals).toStrictEqual([
      responseMalformed,
      responseMalformed,
      responseMalformed,
      responseMalformed,
      responseMalformed,
    ]);

    await expect(redeem({ key })).resolves.toMatchObject({ status: 200 });
  });

  it("answers 401 when the signature, RP ID or key is wrong, whatever the origin", async () => {
    const key = await registeredKey({ session: await signUp() });

    const refusals = await Promise.all([
      redeem({ key, signer: makeRestoreKey() }),
      redeem({ key, origin: makeSigningCertificate().origin, signer: makeRestoreKey() }),
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

  it("refuses a key for a session an admin is impersonating", async () => {
    const [admin, learner] = await Promise.all([signUp(), signUp()]);
    await prisma.user.update({ data: { role: "admin" }, where: { id: admin.userId } });

    const impersonation = await post({
      body: { userId: learner.userId },
      path: "/admin/impersonate-user",
      token: admin.token,
    });

    const { token } = (impersonation.body as { session: { token: string } }).session;
    const key = makeRestoreKey();

    await expect(register({ key, token })).resolves.toMatchObject({
      body: { code: "RESTORE_KEY_REGISTRATION_INVALID" },
      status: 400,
    });

    await expect(prisma.restoreKey.findUnique({ where: { id: key.id } })).resolves.toBeNull();
  });

  it("keeps one key per session, so a new key replaces the session's previous one", async () => {
    const session = await signUp();
    const first = await registeredKey({ session });
    const second = await registeredKey({ session });
    const registering = await prisma.session.findUniqueOrThrow({ where: { token: session.token } });

    await expect(
      prisma.restoreKey.findMany({ where: { sessionId: registering.id } }),
    ).resolves.toStrictEqual([expect.objectContaining({ id: second.id })]);

    await expect(
      Promise.all([redeem({ key: first }), redeem({ key: second })]),
    ).resolves.toMatchObject([keyInvalid, { status: 200 }]);
  });

  it("refuses a credential ID over WebAuthn's 1023 bytes", async () => {
    const session = await signUp();
    const longKey = makeRestoreKey({ idBytes: 1024 });

    const registration = JSON.parse(
      makeRegistrationJson({
        challenge: await issueAppChallenge(),
        key: longKey,
        origin: releaseApp.origin,
      }),
    ) as { id: string; rawId: string };

    const shortId = makeRestoreKey().id;

    const refusals = await Promise.all([
      register({ key: longKey, token: session.token }),
      registerJson({
        json: JSON.stringify({ ...registration, id: shortId, rawId: shortId }),
        token: session.token,
      }),
      redeem({ key: makeRestoreKey({ idBytes: 1024 }) }),
    ]);

    expect(refusals.map((refusal) => refusal.status)).toStrictEqual([400, 400, 400]);

    await expect(
      register({ key: makeRestoreKey({ idBytes: 1023 }), token: session.token }),
    ).resolves.toMatchObject({ status: 200 });
  });

  it("answers 500, never 401, while the Android apps aren't configured", async () => {
    const [registering, other] = await Promise.all([signUp(), signUp()]);
    const key = await registeredKey({ session: registering });

    vi.stubEnv("ANDROID_RELEASE_CERT_FINGERPRINTS", "");
    vi.stubEnv("ANDROID_DEBUG_CERT_FINGERPRINTS", "");

    const answers = await Promise.all([
      redeem({ key }),
      register({ key: makeRestoreKey(), token: other.token }),
    ]);

    expect(answers.map((answer) => answer.status)).toStrictEqual([500, 500]);

    vi.stubEnv("ANDROID_RELEASE_CERT_FINGERPRINTS", `${releaseApp.fingerprint},AB:CD`);

    await expect(redeem({ key })).resolves.toMatchObject({ status: 500 });

    vi.stubEnv("ANDROID_RELEASE_CERT_FINGERPRINTS", releaseApp.fingerprint);

    await expect(redeem({ key })).resolves.toMatchObject({ status: 200 });
  });

  it("answers 500, never 401, in production while only the debug app is configured", async () => {
    const [registering, other] = await Promise.all([signUp(), signUp()]);
    const key = await registeredKey({ session: registering });

    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ANDROID_RELEASE_CERT_FINGERPRINTS", "");

    const answers = await Promise.all([
      redeem({ key }),
      register({ key: makeRestoreKey(), token: other.token }),
    ]);

    expect(answers.map((answer) => answer.status)).toStrictEqual([500, 500]);

    vi.stubEnv("ANDROID_RELEASE_CERT_FINGERPRINTS", releaseApp.fingerprint);

    await expect(redeem({ key })).resolves.toMatchObject({ status: 200 });
  });

  it("answers 500, never 401, for a signed key from an app the config no longer lists", async () => {
    const key = await registeredKey({ session: await signUp() });

    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ANDROID_RELEASE_CERT_FINGERPRINTS", makeSigningCertificate().fingerprint);

    const answers = await Promise.all([redeem({ key }), redeem({ key, signer: makeRestoreKey() })]);

    expect(answers.map((answer) => answer.status)).toStrictEqual([500, 401]);

    vi.stubEnv("ANDROID_RELEASE_CERT_FINGERPRINTS", releaseApp.fingerprint);

    await expect(redeem({ key })).resolves.toMatchObject({ status: 200 });
  });

  it("answers 500 for a fingerprint that isn't 64 hex digits", async () => {
    const [releaseSession, debugSession] = await Promise.all([signUp(), signUp()]);
    const releaseKey = await registeredKey({ session: releaseSession });
    const debugKey = makeRestoreKey();

    await expect(
      register({ key: debugKey, origin: debugApp.origin, token: debugSession.token }),
    ).resolves.toMatchObject({ status: 200 });

    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("ANDROID_DEBUG_CERT_FINGERPRINTS", "");
    vi.stubEnv("ANDROID_RELEASE_CERT_FINGERPRINTS", `${releaseApp.fingerprint}INVALID`);

    await expect(redeem({ key: releaseKey })).resolves.toMatchObject({ status: 500 });

    vi.stubEnv("ANDROID_RELEASE_CERT_FINGERPRINTS", `${debugApp.fingerprint}INVALID`);

    await expect(redeem({ key: debugKey, origin: debugApp.origin })).resolves.toMatchObject({
      status: 500,
    });
  });
});
