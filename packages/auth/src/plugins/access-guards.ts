import { type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { ACCESS_ERROR_CODES } from "../access-contract";
import { findRequestGuest } from "../guests/guest-request";
import { linkGuestAccount } from "../guests/link-guest-account";

/** Guests need an account before buying Plus. */
const guardPlusPurchase = createAuthMiddleware(async (context) => {
  const session = await getSessionFromCtx(context);

  if (session?.user.isAnonymous) {
    throw new APIError("FORBIDDEN", {
      code: ACCESS_ERROR_CODES.guestPurchaseNotAllowed,
      message: "Create an account before subscribing.",
    });
  }
});

/**
 * Apps sign in on the central auth host and receive the session through a one-time token, which the
 * anonymous plugin's own link hook doesn't see. Linking here keeps a guest's progress when the
 * sign-in comes back to the app that holds the guest cookie.
 */
const linkGuestAfterTokenSignIn = createAuthMiddleware(async (context) => {
  const newSession = context.context.newSession;

  if (!newSession || newSession.user.isAnonymous) {
    return;
  }

  const guest = await findRequestGuest(context);

  if (!guest || guest.id === newSession.user.id) {
    return;
  }

  await linkGuestAccount({ account: newSession.user, guestUserId: guest.id });
});

/** Guest and purchase rules that apply to the whole auth surface, not one endpoint. */
export function accessGuardsPlugin() {
  return {
    hooks: {
      after: [
        {
          handler: linkGuestAfterTokenSignIn,
          matcher: (context) => context.path === "/one-time-token/verify",
        },
      ],
      before: [
        {
          handler: guardPlusPurchase,
          matcher: (context) => context.path === "/subscription/upgrade",
        },
      ],
    },
    id: "access-guards",
  } satisfies BetterAuthPlugin;
}
