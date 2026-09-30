import "server-only";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getEnergyLevel } from "@zoonk/core/progress/get-energy-level";
import { getStudiedToday } from "@zoonk/core/progress/get-studied-today";
import { type LearnBuddy } from "@zoonk/learn/navigation";

/**
 * The learner's buddy as Fun draws it: kind, name and glasses from the profile, growth from the
 * belt and glow from Energy. Null without a buddy (Focus learners, or before onboarding picks one).
 */
export async function getLearnerBuddy(): Promise<LearnBuddy | null> {
  const [profile, belt, energy, studiedToday] = await Promise.all([
    getLearningProfile(),
    getBeltLevel(),
    getEnergyLevel(),
    getStudiedToday(),
  ]);

  if (!profile?.buddy) {
    return null;
  }

  return {
    beltColor: belt?.color ?? "white",
    energy: energy?.currentEnergy ?? 0,
    glasses: profile.buddy.glasses,
    kind: profile.buddy.kind,
    name: profile.buddy.name,
    studiedToday,
  };
}
