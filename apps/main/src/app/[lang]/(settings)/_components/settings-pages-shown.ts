import { getAllowance } from "@zoonk/core/entitlements/get-allowance";
import { getSession } from "@zoonk/core/users/session";
import { type SettingsPagesShown } from "./settings-links";

/**
 * Which settings pages apply to whoever is here: the profile belongs to an account, memory to
 * anyone with a session (guests too). An account gets its way out in the list, and "Subscription" says "Plus" when that's the plan.
 */
export async function getSettingsPagesShown(): Promise<SettingsPagesShown> {
  const [session, allowance] = await Promise.all([getSession(), getAllowance()]);

  const hasAccount = Boolean(session && !session.user.isAnonymous);

  return {
    plus: allowance?.tier === "plus",
    showLogout: hasAccount,
    showMemory: Boolean(session),
    showProfile: !session?.user.isAnonymous,
  };
}
