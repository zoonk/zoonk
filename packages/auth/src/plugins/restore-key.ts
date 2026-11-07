import { type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { ACCESS_ERROR_CODES } from "../access-contract";
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
  appProofInvalid: {
    code: ACCESS_ERROR_CODES.botDetected,
    message: "This request has no valid proof that it comes from Zoonk's Android app",
    status: "FORBIDDEN",
  },
  challengeInvalid: {
    code: RESTORE_KEY_ERROR_CODES.challengeInvalid,
    message: "This challenge wasn't issued here, or it was already used or expired",
    status: "BAD_REQUEST",
  },
  keyInvalid: {
    code: RESTORE_KEY_ERROR_CODES.keyInvalid,
    message: "This restore key can't sign in",
    status: "UNAUTHORIZED",
  },
  registrationInvalid: {
    code: RESTORE_KEY_ERROR_CODES.registrationInvalid,
    message: "This restore key's registration is invalid",
    status: "BAD_REQUEST",
  },
  responseMalformed: {
    code: RESTORE_KEY_ERROR_CODES.responseMalformed,
    message: "This isn't a restore key response",
    status: "BAD_REQUEST",
  },
} as const;

function refuse(refusal: RestoreKeyRefusal) {
  const { code, message, status } = REFUSALS[refusal];
  return new APIError(status, { code, message });
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
            headers: context.headers ?? new Headers(),
            registrationResponseJson: context.body.registrationResponseJson,
            session: context.context.session.session,
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
