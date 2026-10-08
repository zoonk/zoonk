import { anonymous } from "better-auth/plugins";
import { linkGuestAccount } from "../guests/link-guest-account";

/**
 * Guests are anonymous Better Auth users, so core capabilities work for them through the same
 * session. When a guest signs up or signs in, their progress moves to that account.
 */
export function guestPlugin() {
  return anonymous({
    onLinkAccount: async ({ anonymousUser, newUser }) => {
      await linkGuestAccount({ account: newUser.user, guestUserId: anonymousUser.user.id });
    },
  });
}
