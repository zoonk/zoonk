import { anonymous } from "better-auth/plugins";
import { linkGuestAccount } from "../guests/link-guest-account";

export function guestPlugin() {
  return anonymous({
    onLinkAccount: async ({ anonymousUser, newUser }) => {
      await linkGuestAccount({
        account: newUser.user,
        guestSessionId: anonymousUser.session.id,
        guestUserId: anonymousUser.user.id,
        sessionId: newUser.session.id,
      });
    },
  });
}
