import "server-only";
import { DEFAULT_BUDDY } from "@zoonk/core/profile/default-buddy";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getEnergyLevel } from "@zoonk/core/progress/get-energy-level";
import { getStudiedToday } from "@zoonk/core/progress/get-studied-today";

/**
 * The learner's buddy: kind, name and glasses from the profile, growth from the belt and glow from
 * Energy, which is null until the learner has learned something (a new buddy is awake, without a
 * glow). Zu until the learner saves a choice, including for visitors without a profile.
 */
export async function getLearnerBuddy() {
  const [profile, belt, energy, studiedToday] = await Promise.all([
    getLearningProfile(),
    getBeltLevel(),
    getEnergyLevel(),
    getStudiedToday(),
  ]);

  const buddy = profile?.buddy ?? DEFAULT_BUDDY;

  return {
    beltColor: belt?.color ?? "white",
    energy: energy?.currentEnergy ?? null,
    ...buddy,
    studiedToday,
  };
}

export type LearnerBuddy = Awaited<ReturnType<typeof getLearnerBuddy>>;
