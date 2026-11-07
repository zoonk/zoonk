import { type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import {
  RESTORE_KEY_ERROR_CODES,
  restoreKeyRequestSchema,
  restoreKeySessionRequestSchema,
} from "../restore-keys/restore-key-contract";
import {
  type RestoreKeyRefusal,
  redeemRestoreKey,
  registerRestoreKey,
} from "../restore-keys/restore-keys";

const REFUSALS = {
  challengeInvalid: {
    message: "This challenge wasn't issued here, or it was already used or expired",
    status: "BAD_REQUEST",
  },
  keyInvalid: { message: "This restore key can't sign in", status: "UNAUTHORIZED" },
  registrationInvalid: {
    message: "This restore key's registration is invalid",
    status: "BAD_REQUEST",
  },
  responseMalformed: { message: "This isn't a restore key response", status: "BAD_REQUEST" },
} as const;

function refuse(refusal: RestoreKeyRefusal) {
  const { message, status } = REFUSALS[refusal];
  return new APIError(status, { code: RESTORE_KEY_ERROR_CODES[refusal], message });
}

/** Auth endpoints, so Better Auth's IP rate limit covers them like every sign-in. */
export function restoreKeyPlugin() {
  return {
    endpoints: {
      createRestoreKey: createAuthEndpoint(
        "/restore-key/register",
        { body: restoreKeyRequestSchema, method: "POST", use: [sessionMiddleware] },
        async (context) => {
          const refusal = await registerRestoreKey({
            registrationResponseJson: context.body.registrationResponseJson,
            sessionId: context.context.session.session.id,
          });

          if (refusal) {
            throw refuse(refusal);
          }

          return context.json({ registered: true });
        },
      ),
      createRestoreKeySession: createAuthEndpoint(
        "/restore-key/session",
        { body: restoreKeySessionRequestSchema, method: "POST" },
        async (context) => {
          const redemption = await redeemRestoreKey(context.body.authenticationResponseJson);

          if (redemption.refusal) {
            throw refuse(redemption.refusal);
          }

          const session = await context.context.internalAdapter.createSession(redemption.user.id);

          return context.json({ isGuest: redemption.user.isAnonymous, token: session.token });
        },
      ),
    },
    id: "restore-key",
  } satisfies BetterAuthPlugin;
}
