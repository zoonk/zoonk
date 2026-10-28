import "server-only";
import {
  type GoalTutorPage,
  type TutorLink,
  listGoalTutorPages,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-pages";
import { type Goal } from "@zoonk/db";
import { type LinkScope } from "../plan-day-context";

const PERCENT = 100;

export type Lookup = { area: string | null; goal: Goal; query: string | null; scope: LinkScope };

/** Open-goal pages may link only from that goal's own conversation. */
export function toPageLink({
  page,
  scope,
}: {
  page: GoalTutorPage;
  scope: LinkScope;
}): TutorLink | null {
  return listGoalTutorPages({ selectedGoal: scope.activeGoal }).includes(page)
    ? { kind: "page", page }
    : null;
}

/** Converts a fraction from 0 to 1 into rounded points out of 100. */
export function toPoints(share: number): number {
  return Math.round(share * PERCENT);
}
