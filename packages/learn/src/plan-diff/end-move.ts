import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { daysBetween } from "../_utils/iso-date";

type EndMoveEffect = Pick<
  NonNullable<PlanChangeView["effect"]>,
  "endDateAfter" | "endDateBefore" | "lessonsAdded" | "lessonsRemoved"
>;

const ROUNDING_DAYS = 1;

/**
 * Not by a day or less while the change adds or leaves out lessons: an end a day earlier beside
 * lessons left out reads backwards.
 */
export function getShownEndMove(
  effect: EndMoveEffect | null | undefined,
): { after: string; before: string } | null {
  const after = effect?.endDateAfter;
  const before = effect?.endDateBefore;

  if (!effect || !after || !before || after === before) {
    return null;
  }

  const lessonsChange = effect.lessonsAdded > 0 || effect.lessonsRemoved > 0;
  const rounding = Math.abs(daysBetween(before, after)) <= ROUNDING_DAYS;

  return lessonsChange && rounding ? null : { after, before };
}
