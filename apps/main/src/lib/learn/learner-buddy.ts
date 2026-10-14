import "server-only";
import { getBuddyStatus } from "@zoonk/core/milestones/buddy";
import { DEFAULT_BUDDY } from "@zoonk/core/profile/default-buddy";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { getBeltLevel } from "@zoonk/core/progress/get-belt-level";
import { getEnergyLevel } from "@zoonk/core/progress/get-energy-level";
import { getEnergyStarted } from "@zoonk/core/progress/get-energy-started";
import { getStudiedToday } from "@zoonk/core/progress/get-studied-today";
import { cache } from "react";
import { getReadAt } from "./read-at";
import { countTabMissions } from "./tab-missions";

/**
 * The learner's buddy: kind, name and glasses from the profile, growth from the belt and glow from
 * Energy, which is null until a day of study has passed (a new buddy is awake, without a glow).
 * Zu until the learner saves a choice, including for visitors without a profile.
 */
export async function getLearnerBuddy() {
  const [profile, belt, energy, energyStarted, studiedToday] = await Promise.all([
    getLearningProfile(),
    getBeltLevel(),
    getEnergyLevel(),
    getEnergyStarted(),
    getStudiedToday(),
  ]);

  const buddy = profile?.buddy ?? DEFAULT_BUDDY;

  return {
    beltColor: belt?.color ?? "white",
    energy: energyStarted ? (energy?.currentEnergy ?? 0) : null,
    ...buddy,
    studiedToday,
  };
}

export type LearnerBuddy = Awaited<ReturnType<typeof getLearnerBuddy>>;

/** The buddy's status, read once per request; null without a ready one. */
const getReadyBuddyStatus = cache(async () => {
  const result = await getBuddyStatus({});
  return result.status === "ready" ? result.buddy : null;
});

/** The learner's Brain Power so far, which the missions' reward says when tapped; null without it. */
export async function getBrainPowerTotal(): Promise<number | null> {
  const status = await getReadyBuddyStatus();
  return status?.belt.totalBrainPower ?? null;
}

/**
 * Today's missions as the buddy's tab counts them, or null before today's session exists, without
 * one, or on a day that offers none, so the tab wears no empty ring.
 */
async function getTodayMissions() {
  const status = await getReadyBuddyStatus();
  return countTabMissions(status?.today?.missions ?? null);
}

/**
 * What the buddy's tab shows wherever the tabs are (its face, its name and today's missions), read
 * together, for the app's sidebar and tab bar, with when they were read: a page that read the
 * missions since tells the tabs (`useTabMissions`).
 */
export async function getLearnTabs() {
  const [buddy, missions, readAt] = await Promise.all([
    getLearnerBuddy(),
    getTodayMissions(),
    getReadAt(),
  ]);

  return { buddy, missions, readAt };
}
