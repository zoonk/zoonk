import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { daysBetween } from "../_utils/iso-date";

type EndMoveEffect = Pick<
  NonNullable<PlanChangeView["effect"]>,
  "endDateAfter" | "endDateBefore" | "lessonsAdded" | "lessonsRemoved"
>;

/** The most days the plan's end can move and still read as rounding beside lessons that change. */
const ROUNDING_DAYS = 1;

/**
 * The plan's end a change moves, when it's worth saying: it moves, and not by a day or less while
 * the change adds or leaves out lessons, which is what the learner weighs (an end a day earlier
 * beside lessons left out reads backwards). Null when the end stays or isn't worth saying.
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
