import { isJsonObject } from "@zoonk/utils/json";
import { type BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import {
  confirmPasskeyChange,
  createPasskeyChangeOptions,
  spendPasskeyConfirmation,
} from "../passkeys/passkey-change";
import {
  PASSKEY_CHANGE_ERROR_CODES,
  passkeyChangeApprovalSchema,
  passkeyChangeSchema,
} from "../passkeys/passkey-change-contract";

const REGISTRATION_STEPS = {
  "/passkey/generate-register-options": "add",
  "/passkey/verify-registration": "register",
} as const;

function isRegistrationPath(path?: string): path is keyof typeof REGISTRATION_STEPS {
  return path !== undefined && path in REGISTRATION_STEPS;
}

function readStep(context: { body?: unknown; path?: string }) {
  if (isRegistrationPath(context.path)) {
    return REGISTRATION_STEPS[context.path];
  }

  const id = isJsonObject(context.body) ? context.body.id : null;
  return typeof id === "string" ? (`delete:${id}` as const) : null;
}

/** The passkey plugin's own endpoints answer a missing session or a malformed body. */
const requireConfirmation = createAuthMiddleware(async (context) => {
  const session = await getSessionFromCtx(context);
  const step = readStep(context);

  if (!session || !step) {
    return;
  }

  if (
    !(await spendPasskeyConfirmation({
      sessionId: session.session.id,
      step,
      userId: session.user.id,
    }))
  ) {
    throw new APIError("FORBIDDEN", {
      code: PASSKEY_CHANGE_ERROR_CODES.confirmationRequired,
      message: "Confirm with a passkey you already have before adding or deleting one.",
    });
  }
});

/**
 * Once an account has a passkey, adding or deleting one takes a confirmation from an existing
 * passkey, which only the person holding it can give.
 */
export function passkeyChangePlugin() {
  return {
    endpoints: {
      confirmPasskeyChange: createAuthEndpoint(
        "/passkey-change/approval",
        { body: passkeyChangeApprovalSchema, method: "POST", use: [sessionMiddleware] },
        async (context) => {
          const confirmed = await confirmPasskeyChange({
            ...context.body,
            sessionId: context.context.session.session.id,
            userId: context.context.session.user.id,
          });

          if (!confirmed) {
            throw new APIError("FORBIDDEN", {
              code: PASSKEY_CHANGE_ERROR_CODES.confirmationInvalid,
              message: "This isn't one of your passkeys confirming this change.",
            });
          }

          return context.json({ confirmed });
        },
      ),
      createPasskeyChangeOptions: createAuthEndpoint(
        "/passkey-change/options",
        { body: passkeyChangeSchema, method: "POST", use: [sessionMiddleware] },
        async (context) =>
          context.json({
            options: await createPasskeyChangeOptions({
              change: context.body,
              sessionId: context.context.session.session.id,
              userId: context.context.session.user.id,
            }),
          }),
      ),
    },
    hooks: {
      before: [
        {
          handler: requireConfirmation,
          matcher: (context) =>
            isRegistrationPath(context.path) || context.path === "/passkey/delete-passkey",
        },
      ],
    },
    id: "passkey-change",
  } satisfies BetterAuthPlugin;
}
