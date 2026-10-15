import { getActiveSubscription } from "@zoonk/core/auth/subscription";
import { getSession } from "@zoonk/core/users/session";
import { type SettingsPagesShown } from "./settings-links";

/**
 * Which settings pages apply to whoever is here: the profile belongs to an account (not a guest's
 * session, nor a visitor). Memory is listed for everyone, a visitor's page asking them to log in,
 * so its tab is there and marked when they're on it. An account gets its way out in the list, and
 * "Subscription" says "Plus" when that's the plan.
 */
export async function getSettingsPagesShown(): Promise<SettingsPagesShown> {
  const [session, subscription] = await Promise.all([getSession(), getActiveSubscription()]);

  const hasAccount = Boolean(session && !session.user.isAnonymous);

  return {
    plus: hasAccount && Boolean(subscription),
    showLogout: hasAccount,
    showProfile: hasAccount,
  };
}
