import "server-only";
import { getBuddyStatus } from "@zoonk/core/milestones/buddy";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getEnergyLevel } from "@zoonk/core/progress/get-energy-level";
import { getEnergyStarted } from "@zoonk/core/progress/get-energy-started";
import { getStudiedToday } from "@zoonk/core/progress/get-studied-today";
import { countDoneMissions } from "@zoonk/core/sessions/missions";

/**
 * The learner's buddy: kind, name and glasses from the profile, growth from the belt and glow from
 * Energy, which is null until a day of study has passed (a new buddy is awake, without a glow).
 * Null until the learner picks one.
 */
export async function getLearnerBuddy() {
  const [profile, belt, energy, energyStarted, studiedToday] = await Promise.all([
    getLearningProfile(),
    getBeltLevel(),
    getEnergyLevel(),
    getEnergyStarted(),
    getStudiedToday(),
  ]);

  if (!profile?.buddy) {
    return null;
  }

  return {
    beltColor: belt?.color ?? "white",
    energy: energyStarted ? (energy?.currentEnergy ?? 0) : null,
    glasses: profile.buddy.glasses,
    kind: profile.buddy.kind,
    name: profile.buddy.name,
    studiedToday,
  };
}

export type LearnerBuddy = Awaited<ReturnType<typeof getLearnerBuddy>>;

/**
 * Today's missions as the buddy's tab counts them (`countDoneMissions`: a mission with nothing to
 * do today counts once another is done), or null before today's session exists or without one.
 */
export async function getTodayMissions(): Promise<{ done: number; total: number } | null> {
  const result = await getBuddyStatus({});
  const today = result.status === "ready" ? result.buddy.today : null;

  if (!today) {
    return null;
  }

  return { done: countDoneMissions(today.missions), total: today.missions.length };
}
