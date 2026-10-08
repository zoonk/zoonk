import { getAllowance } from "@zoonk/core/entitlements/get-allowance";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getSession } from "@zoonk/core/users/session";
import { type SettingsPagesShown } from "./settings-links";

/**
 * Which settings pages apply to whoever is here: the profile belongs to an account, memory to
 * anyone with a session (guests too), and guardian links to learners under 18. An account gets
 * its way out in the list, and "Subscription" says "Plus" when that's the plan.
 */
export async function getSettingsPagesShown(): Promise<SettingsPagesShown> {
  const [session, profile, allowance] = await Promise.all([
    getSession(),
    getLearningProfile(),
    getAllowance(),
  ]);

  const hasAccount = Boolean(session && !session.user.isAnonymous);

  return {
    plus: allowance?.tier === "plus",
    showGuardian: hasAccount && profile?.ageGroup === "teen",
    showLogout: hasAccount,
    showMemory: Boolean(session),
    showProfile: !session?.user.isAnonymous,
  };
}
