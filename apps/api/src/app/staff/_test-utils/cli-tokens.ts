import { randomUUID } from "node:crypto";
import { auth } from "@zoonk/auth";
import { CLI_CLIENT_ID, STAFF_READ_SCOPE } from "@zoonk/auth/cli-login-contract";
import { prisma } from "@zoonk/db";
import { headers } from "next/headers";
import { vi } from "vitest";

const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

type CliUser = { email: string; id: string; password: string };

async function signIn(user: CliUser): Promise<Headers> {
  const signedIn = await auth.api.signInEmail({
    body: { email: user.email, password: user.password },
    returnHeaders: true,
  });

  const cookie = signedIn.headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");

  return new Headers({ cookie });
}

/** Another public client allowed the device grant, so its tokens are real but not the CLI's. */
export async function otherCliClientFixture(): Promise<string> {
  const client = await prisma.oauthClient.create({
    data: {
      clientId: `other-cli-${randomUUID()}`,
      grantTypes: [DEVICE_CODE_GRANT_TYPE, "refresh_token"],
      redirectUris: [],
      scopes: [STAFF_READ_SCOPE, "offline_access"],
      tokenEndpointAuthMethod: "none",
    },
  });

  return client.clientId;
}

/**
 * Logs `user` in through the real device flow, as `pnpm zoonk login` does: the CLI asks for a code,
 * the user approves it signed in, and the CLI exchanges it. `state` then expires or revokes the
 * access token the way time or `pnpm zoonk logout` would.
 */
export async function cliTokenFixture({
  clientId = CLI_CLIENT_ID,
  scopes = [STAFF_READ_SCOPE, "offline_access"],
  state = "active",
  user,
}: {
  clientId?: string;
  scopes?: string[];
  state?: "active" | "expired" | "revoked";
  user: CliUser;
}): Promise<{ accessToken: string; refreshToken?: string }> {
  const code = await auth.api.deviceCode({
    body: { client_id: clientId, scope: scopes.join(" ") },
  });

  const browser = await signIn(user);

  await auth.api.deviceVerify({ headers: browser, query: { user_code: code.user_code } });
  await auth.api.deviceApprove({ body: { userCode: code.user_code }, headers: browser });

  const tokens = await auth.api.oauth2Token({
    body: {
      client_id: clientId,
      device_code: code.device_code,
      grant_type: DEVICE_CODE_GRANT_TYPE,
    },
  });

  if (state === "expired") {
    await prisma.oauthAccessToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
      where: { clientId, userId: user.id },
    });
  }

  if (state === "revoked") {
    await auth.api.oauth2Revoke({
      body: { client_id: clientId, token: tokens.access_token, token_type_hint: "access_token" },
    });
  }

  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
}

/** Staff capabilities read the token from `headers()`, which Next.js answers from the request. */
export function sendStaffAuthorization(authorization?: string): Headers {
  const requestHeaders = new Headers(authorization ? { authorization } : {});
  vi.mocked(headers).mockResolvedValue(requestHeaders);

  return requestHeaders;
}
