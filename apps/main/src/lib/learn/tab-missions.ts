import { type Mission, countDoneMissions } from "@zoonk/core/sessions/missions";
import { type LearnTabMissions } from "@zoonk/learn/navigation";

/**
 * Today's missions as the buddy's tab counts them, or null on a day without any, so the tab wears
 * no empty ring. The frame's read and the pages' own reads count them the same way.
 */
export function countTabMissions(missions: readonly Mission[] | null): LearnTabMissions {
  if (!missions || missions.length === 0) {
    return null;
  }

  return { done: countDoneMissions(missions), total: missions.length };
}
