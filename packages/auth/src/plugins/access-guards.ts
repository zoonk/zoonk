import { type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { ACCESS_ERROR_CODES } from "../access-contract";
import { findRequestGuest } from "../guests/guest-request";
import { linkGuestAccount } from "../guests/link-guest-account";
import { getPlusPurchaseStatus } from "../minors/plus-purchase";
import { getNetworkKey } from "../request-guards/network-key";
import { RATE_LIMIT_RULES, isRateLimited } from "../request-guards/rate-limit";

/**
 * Each guest can start lessons, so guests are created only behind BotID (`botCheckPlugin`) and a
 * per-network cap.
 */
const guardGuestCreation = createAuthMiddleware(async (context) => {
  const requestHeaders = context.headers ?? new Headers();

  const isLimited = await isRateLimited({
    key: getNetworkKey(requestHeaders),
    requestHeaders,
    rule: RATE_LIMIT_RULES.guestSignIn,
  });

  if (isLimited) {
    throw new APIError("TOO_MANY_REQUESTS", {
      code: ACCESS_ERROR_CODES.guestSignInLimitReached,
      message: "Too many guests from this network. Try again later.",
    });
  }
});

/** Guests need an account before buying Plus, and learners under 18 need their guardian's approval. */
const guardPlusPurchase = createAuthMiddleware(async (context) => {
  const session = await getSessionFromCtx(context);

  if (!session) {
    return;
  }

  const status = await getPlusPurchaseStatus(session.user.id);

  if (status === "guestNotAllowed") {
    throw new APIError("FORBIDDEN", {
      code: ACCESS_ERROR_CODES.guestPurchaseNotAllowed,
      message: "Create an account before subscribing.",
    });
  }

  if (status === "needsGuardianApproval") {
    throw new APIError("FORBIDDEN", {
      code: ACCESS_ERROR_CODES.guardianApprovalRequired,
      message: "A guardian needs to approve Plus first.",
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
  await context.context.internalAdapter.deleteUser(guest.id);
});

/** Abuse, guest and purchase rules that apply to the whole auth surface, not one endpoint. */
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
          handler: guardGuestCreation,
          matcher: (context) => context.path === "/sign-in/anonymous",
        },
        {
          handler: guardPlusPurchase,
          matcher: (context) => context.path === "/subscription/upgrade",
        },
      ],
    },
    id: "access-guards",
  } satisfies BetterAuthPlugin;
}
