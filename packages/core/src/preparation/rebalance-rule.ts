import { MS_PER_DAY } from "@zoonk/utils/date";
import { type AreaPreparation } from "./area-preparation";

export const REBALANCE_SOURCE = "preparation";

const REBALANCE_EVERY_DAYS = 7;

const SOLID_SHARE = 0.5;

export type RebalanceArea = Pick<
  AreaPreparation,
  "areaId" | "needsPractice" | "skills" | "weekGain"
> & { planAreas: readonly string[] };

function isGoingWell(area: RebalanceArea): boolean {
  const studied = area.skills.total - area.skills.new;
  const solid = area.skills.solid + area.skills.mastered;

  return !area.needsPractice && area.weekGain > 0 && studied > 0 && solid / studied >= SOLID_SHARE;
}

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
