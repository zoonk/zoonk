import { isJsonObject } from "@zoonk/utils/json";
import { type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { ACCESS_ERROR_CODES } from "../access-contract";
import { findRequestGuest } from "../guests/guest-request";
import { linkGuestAccount } from "../guests/link-guest-account";

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
 * A brand's slug and kind are in all its courses' public addresses. Moving or deleting a brand
 * needs a migration with redirects and cache expiry that doesn't exist yet.
 */
const guardBrandAddress = createAuthMiddleware(async (context) => {
  const body: unknown = context.body;
  const data = isJsonObject(body) ? body.data : null;
  const sendsAddress = isJsonObject(data) && ("slug" in data || "kind" in data);

  if (context.path === "/organization/delete" || sendsAddress) {
    throw new APIError("FORBIDDEN", {
      code: ACCESS_ERROR_CODES.brandAddressLocked,
      message: "Brand addresses can't change here.",
    });
  }
});

/** The anonymous plugin's link hook doesn't see one-time token sign-ins, which is how apps get a central-host session. */
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
        {
          handler: guardBrandAddress,
          matcher: (context) =>
            context.path === "/organization/update" || context.path === "/organization/delete",
        },
      ],
    },
    id: "access-guards",
  } satisfies BetterAuthPlugin;
}
