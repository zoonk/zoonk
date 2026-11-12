import {
  getOAuthProviderApi,
  oauthDeviceAuthorization,
  oauthProvider,
} from "@better-auth/oauth-provider";
import { safeAsync } from "@zoonk/utils/error";
import { MAIN_URL } from "@zoonk/utils/url";
import { type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, isAPIError } from "better-auth/api";
import { z } from "zod";
import {
  CLI_CLIENT_ID,
  CLI_LOGIN_APPROVAL_PATH,
  STAFF_PROPOSE_SCOPE,
  STAFF_READ_SCOPE,
} from "../cli-login-contract";

/** Agents sharing one login refresh at the same moment; within this window they all get the same new pair. */
const REFRESH_TOKEN_REUSE_SECONDS = 10;

const APPROVAL_URL = new URL(CLI_LOGIN_APPROVAL_PATH, MAIN_URL).toString();

const cliOAuthProvider = oauthProvider({
  // No one registers or edits OAuth clients over HTTP; the CLI's client comes from a migration.
  clientPrivileges: () => false,
  // Only the authorization code flow opens the consent and login pages, and no client may use it.
  consentPage: APPROVAL_URL,
  disableJwtPlugin: true,
  // The provider refuses refresh tokens without the authorization code grant enabled.
  grantTypes: ["authorization_code", "refresh_token"],
  loginPage: APPROVAL_URL,
  refreshTokenReuseInterval: REFRESH_TOKEN_REUSE_SECONDS,
  resourcePrivileges: () => false,
  scopes: [STAFF_READ_SCOPE, STAFF_PROPOSE_SCOPE, "offline_access"],
});

/**
 * Checks a CLI access token in-process for core's staff capabilities. Server-only, so it isn't
 * reachable over HTTP.
 */
function cliAccessTokenPlugin() {
  return {
    endpoints: {
      verifyCliAccessToken: createAuthEndpoint(
        "/cli/verify-access-token",
        { body: z.object({ token: z.string() }), metadata: { SERVER_ONLY: true }, method: "POST" },
        async (ctx) => {
          const api = getOAuthProviderApi(ctx, cliOAuthProvider.options);

          const { data: access, error } = await safeAsync(async () =>
            api.validateAccessToken(ctx.body.token, CLI_CLIENT_ID),
          );

          if (error && !isAPIError(error)) {
            throw error;
          }

          // A key-bound (DPoP) token counts only with a proof of its key, which staff routes don't
          // ask for, and the CLI never binds its tokens; the provider has no setting to refuse them.
          if (!access?.active || typeof access.sub !== "string" || access.cnf !== undefined) {
            return ctx.json(null);
          }

          return ctx.json({
            clientId: CLI_CLIENT_ID,
            scopes: typeof access.scope === "string" ? access.scope.split(" ") : [],
            userId: access.sub,
          });
        },
      ),
    },
    id: "cli-access-token",
  } satisfies BetterAuthPlugin;
}

/** OAuth device login for the CLI. Its tokens are OAuth tokens, never Better Auth sessions. */
export const cliLoginPlugins = [
  cliOAuthProvider,
  oauthDeviceAuthorization({ verificationUri: APPROVAL_URL }),
  cliAccessTokenPlugin(),
] as const;
