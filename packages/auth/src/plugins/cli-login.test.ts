import { randomUUID } from "node:crypto";
import { DEVICE_CODE_GRANT_TYPE } from "@better-auth/oauth-provider";
import { prisma } from "@zoonk/db";
import { MAIN_URL } from "@zoonk/utils/url";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it } from "vitest";
import { CLI_CLIENT_ID, STAFF_READ_SCOPE } from "../cli-login-contract";
import { BETTER_AUTH_BASE_PATH } from "../config";
import { baseAuthConfig, baseAuthPlugins, fullPlugins } from "../server";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "cli-login-password";
const CLI_SCOPES = `${STAFF_READ_SCOPE} offline_access`;

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
  plugins: [...baseAuthPlugins, ...fullPlugins],
  rateLimit: { enabled: false },
  secret: "cli-login-plugin-test-secret-with-enough-entropy",
});

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
};

/** The CLI sends form bodies with no cookie and no Origin, as RFC 8628 and RFC 6749 describe. */
function cliPost(
  path: string,
  fields: Record<string, string>,
  headers?: Record<string, string>,
): Promise<Response> {
  return auth.handler(
    new Request(`${ORIGIN}${BETTER_AUTH_BASE_PATH}${path}`, {
      body: new URLSearchParams(fields),
      headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
      method: "POST",
    }),
  );
}

function browserRequest({
  body,
  cookie,
  method = "POST",
  path,
}: {
  body?: unknown;
  cookie?: string;
  method?: "GET" | "POST";
  path: string;
}): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json", origin: ORIGIN });

  if (cookie) {
    headers.set("cookie", cookie);
  }

  return auth.handler(
    new Request(`${ORIGIN}${BETTER_AUTH_BASE_PATH}${path}`, {
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      headers,
      method,
    }),
  );
}

async function signUp() {
  const response = await browserRequest({
    body: { email: `cli-login-${randomUUID()}@example.test`, name: "Admin", password: PASSWORD },
    path: "/sign-up/email",
  });

  const { user } = await response.json();

  const cookie = response.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");

  return { cookie, userId: String(user.id) };
}

async function requestDeviceCode() {
  const response = await cliPost("/device/code", { client_id: CLI_CLIENT_ID, scope: CLI_SCOPES });
  expect(response.status).toBe(200);

  return (await response.json()) as {
    device_code: string;
    expires_in: number;
    interval: number;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
  };
}

function pollToken(deviceCode: string) {
  return cliPost("/oauth2/token", {
    client_id: CLI_CLIENT_ID,
    device_code: deviceCode,
    grant_type: DEVICE_CODE_GRANT_TYPE,
  });
}

async function approve({ cookie, userCode }: { cookie: string; userCode: string }) {
  const verify = await browserRequest({
    cookie,
    method: "GET",
    path: `/device?user_code=${userCode}`,
  });

  expect(verify.status).toBe(200);

  const approval = await browserRequest({ body: { userCode }, cookie, path: "/device/approve" });
  expect(approval.status).toBe(200);
}

/** Each call is another machine's login; pass `account` to log the same person in again. */
async function logIn(account?: Awaited<ReturnType<typeof signUp>>) {
  const learner = account ?? (await signUp());
  const { device_code: deviceCode, user_code: userCode } = await requestDeviceCode();
  await approve({ cookie: learner.cookie, userCode });

  const response = await pollToken(deviceCode);
  expect(response.status).toBe(200);

  return { ...learner, tokens: (await response.json()) as TokenResponse };
}

function refresh(refreshToken: string, headers?: Record<string, string>) {
  return cliPost(
    "/oauth2/token",
    { client_id: CLI_CLIENT_ID, grant_type: "refresh_token", refresh_token: refreshToken },
    headers,
  );
}

async function isAccessTokenActive(accessToken: string): Promise<boolean> {
  return (await auth.api.verifyCliAccessToken({ body: { token: accessToken } })) !== null;
}

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** An RFC 9449 proof for a fresh key, which asks the token endpoint to bind the new token to it. */
async function dpopProof(): Promise<string> {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);

  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);

  const signed = `${base64url({ alg: "ES256", jwk, typ: "dpop+jwt" })}.${base64url({
    htm: "POST",
    htu: `${ORIGIN}${BETTER_AUTH_BASE_PATH}/oauth2/token`,
    iat: Math.floor(Date.now() / 1000),
    jti: randomUUID(),
  })}`;

  const signature = await crypto.subtle.sign(
    { hash: "SHA-256", name: "ECDSA" },
    keys.privateKey,
    Buffer.from(signed),
  );

  return `${signed}.${Buffer.from(signature).toString("base64url")}`;
}

describe("CLI login", () => {
  it("gives the CLI a code to show and the approval page to open", async () => {
    const code = await requestDeviceCode();
    const approvalUrl = new URL("/device", MAIN_URL);

    expect(code.verification_uri).toBe(approvalUrl.toString());

    expect(new URL(code.verification_uri_complete).searchParams.get("user_code")).toBe(
      code.user_code,
    );

    expect(code.interval).toBe(5);
    expect(code.expires_in).toBe(1800);
  });

  it("keeps the CLI waiting until someone signed in approves", async () => {
    const { device_code: deviceCode } = await requestDeviceCode();

    const response = await pollToken(deviceCode);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "authorization_pending" });
  });

  it("issues OAuth tokens tied to no browser session, which outlive that session", async () => {
    const { cookie, tokens, userId } = await logIn();

    expect(tokens).toMatchObject({ expires_in: 3600, scope: CLI_SCOPES, token_type: "Bearer" });
    expect(tokens.refresh_token).toBeTruthy();

    const rows = await prisma.oauthAccessToken.findMany({ where: { userId } });
    expect(rows).toMatchObject([{ clientId: CLI_CLIENT_ID, sessionId: null }]);

    await browserRequest({ cookie, path: "/sign-out" });
    await prisma.session.deleteMany({ where: { userId } });

    await expect(
      auth.api.verifyCliAccessToken({ body: { token: tokens.access_token } }),
    ).resolves.toStrictEqual({
      clientId: CLI_CLIENT_ID,
      scopes: [STAFF_READ_SCOPE, "offline_access"],
      userId,
    });
  });

  it("never treats a CLI access token as a session", async () => {
    const { tokens } = await logIn();

    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${tokens.access_token}` }),
    });

    expect(session).toBeNull();
  });

  it("rotates the refresh token and answers a replay right after with the same new pair", async () => {
    const { tokens } = await logIn();

    const first = await refresh(tokens.refresh_token);
    const replay = await refresh(tokens.refresh_token);

    expect([first.status, replay.status]).toStrictEqual([200, 200]);

    const [firstPair, replayPair] = (await Promise.all([first.json(), replay.json()])) as [
      TokenResponse,
      TokenResponse,
    ];

    expect(replayPair.access_token).toBe(firstPair.access_token);
    expect(replayPair.refresh_token).toBe(firstPair.refresh_token);
    expect(firstPair.refresh_token).not.toBe(tokens.refresh_token);

    await expect(
      auth.api.verifyCliAccessToken({ body: { token: firstPair.access_token } }),
    ).resolves.toMatchObject({ clientId: CLI_CLIENT_ID });
  });

  it("ends the login when the CLI revokes its refresh token", async () => {
    const { tokens } = await logIn();

    const revoked = await cliPost("/oauth2/revoke", {
      client_id: CLI_CLIENT_ID,
      token: tokens.refresh_token,
      token_type_hint: "refresh_token",
    });

    expect(revoked.status).toBe(200);

    const response = await refresh(tokens.refresh_token);
    expect(response.status).toBe(400);

    await expect(
      auth.api.verifyCliAccessToken({ body: { token: tokens.access_token } }),
    ).resolves.toBeNull();
  });

  it("ends every access token of a refreshed login when the CLI logs out, keeping the person's other logins", async () => {
    const machine = await logIn();
    const otherMachine = await logIn(machine);

    const rotation = await refresh(machine.tokens.refresh_token);
    const refreshed = (await rotation.json()) as TokenResponse;

    const revoked = await cliPost("/oauth2/revoke", {
      client_id: CLI_CLIENT_ID,
      token: refreshed.refresh_token,
      token_type_hint: "refresh_token",
    });

    expect(revoked.status).toBe(200);

    await expect(isAccessTokenActive(machine.tokens.access_token)).resolves.toBe(false);
    await expect(isAccessTokenActive(refreshed.access_token)).resolves.toBe(false);
    await expect(isAccessTokenActive(otherMachine.tokens.access_token)).resolves.toBe(true);

    const otherRefresh = await refresh(otherMachine.tokens.refresh_token);
    expect(otherRefresh.status).toBe(200);
  });

  it("refuses an access token bound to a key, since staff routes check no proof of it", async () => {
    const { tokens } = await logIn();

    const response = await refresh(tokens.refresh_token, { dpop: await dpopProof() });
    const bound = (await response.json()) as TokenResponse;

    expect(bound.token_type).toBe("DPoP");
    await expect(isAccessTokenActive(bound.access_token)).resolves.toBe(false);
  });

  it("keeps device authorization's session-minting token endpoint closed", async () => {
    const { device_code: deviceCode } = await requestDeviceCode();

    const response = await cliPost("/device/token", {
      client_id: CLI_CLIENT_ID,
      device_code: deviceCode,
      grant_type: DEVICE_CODE_GRANT_TYPE,
    });

    expect(response.status).toBe(404);
  });

  it("refuses device codes for clients that aren't registered", async () => {
    const response = await cliPost("/device/code", {
      client_id: "someone-else",
      scope: CLI_SCOPES,
    });

    expect(response.status).toBe(400);
  });

  it("refuses to register OAuth clients or verify tokens over HTTP", async () => {
    const { cookie } = await signUp();

    const created = await browserRequest({
      body: { client_name: "Mine", redirect_uris: ["https://example.test/callback"] },
      cookie,
      path: "/oauth2/create-client",
    });

    const verified = await browserRequest({
      body: { token: "anything" },
      path: "/cli/verify-access-token",
    });

    expect(created.status).toBe(401);
    expect(verified.status).toBe(404);
  });
});
