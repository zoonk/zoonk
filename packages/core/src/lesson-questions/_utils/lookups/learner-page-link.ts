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

/**
 * One of the app's pages, when the buddy may link it here: a page that shows the open goal only in
 * that goal's own conversation (see `LinkScope`); every other page always.
 */
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

/** A share from 0 to 1 as the app shows it: points out of 100. */
export function toPoints(share: number): number {
  return Math.round(share * PERCENT);
}
