import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getSession } from "@zoonk/core/users/session";
import { type SettingsPagesShown } from "./settings-links";

/** Memory is listed for everyone (a visitor's page asks them to log in), so its tab is marked when they're on it. */
export async function getSettingsPagesShown(): Promise<SettingsPagesShown> {
  const [session, subscription] = await Promise.all([getSession(), getActiveSubscription()]);

  const hasAccount = Boolean(session && !session.user.isAnonymous);

  return {
    plus: hasAccount && Boolean(subscription),
    showLogout: hasAccount,
    showProfile: hasAccount,
  };
}
