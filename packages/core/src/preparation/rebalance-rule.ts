import { MS_PER_DAY } from "@zoonk/utils/date";
import { type AreaPreparation } from "./area-preparation";

/** How a rebalance is marked on its plan change, so the apps can say it in their own words. */
export const REBALANCE_SOURCE = "preparation";

/** At most one rebalance a week: the plan shouldn't wobble with every session. */
const REBALANCE_EVERY_DAYS = 7;

/** An area is going well when most of what was studied there is Solid or Mastered. */
const SOLID_SHARE = 0.5;

export type RebalanceArea = Pick<
  AreaPreparation,
  "areaId" | "needsPractice" | "skills" | "weekGain"
> & {
  /** The plan's names for this area's skills: what a "focus on" plan change points at. */
  planAreas: readonly string[];
};

function isGoingWell(area: RebalanceArea): boolean {
  const studied = area.skills.total - area.skills.new;
  const solid = area.skills.solid + area.skills.mastered;

  return !area.needsPractice && area.weekGain > 0 && studied > 0 && solid / studied >= SOLID_SHARE;
}

/**
 * When one area is going well (mostly Solid, no fading, gaining this week) while the weakest area
 * needs practice, the plan moves time to the weak one: its plan areas come first. Nothing happens
 * when the learner chose their own focus, when the two areas share the plan's areas (focusing
 * would help both), or within a week of the last rebalance. Returns the areas to focus, or null.
 */
export function pickRebalance({
  areas,
  focusAreas,
  lastRebalanceAt,
  now,
  weakestAreaId,
}: {
  areas: readonly RebalanceArea[];
  focusAreas: readonly string[];
  lastRebalanceAt: Date | null;
  now: Date;
  weakestAreaId: string | null;
}): string[] | null {
  const recent =
    lastRebalanceAt !== null &&
    now.getTime() - lastRebalanceAt.getTime() < REBALANCE_EVERY_DAYS * MS_PER_DAY;

  if (recent || focusAreas.length > 0) {
    return null;
  }

  const weak = areas.find((area) => area.areaId === weakestAreaId && area.needsPractice);
  const strong = areas.filter((area) => area.areaId !== weak?.areaId && isGoingWell(area));

  if (!weak || strong.length === 0) {
    return null;
  }

  const strongAreas = new Set(strong.flatMap((area) => area.planAreas));
  const focus = [...new Set(weak.planAreas)].filter((name) => !strongAreas.has(name));

  return focus.length > 0 ? focus : null;
}
