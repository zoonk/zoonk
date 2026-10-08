import "server-only";
import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type GoalSkillNode } from "../../learner/_utils/goal-skill-graph";
import { pickSessionPlacementItems } from "../../learner/placement/_utils/session-placement-items";
import {
  PLACEMENT_WEEK_DAYS,
  SESSION_PLACEMENT_QUESTIONS,
} from "../../learner/placement/placement-budget";
import { getPlacementQuickFormat } from "../../learner/placement/placement-quick-format";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { daysBetween } from "../../plans/planner/plan-calendar";

/** The goal, learner and day a session is built for. */
export type SessionDayContext = {
  goal: Goal;
  localDate: Date;
  now: Date;
  timeZone: string;
  userId: string;
};

type BuildContext = SessionDayContext;

/**
 * Placement's first week: a goal's sessions ask a few placement questions while a starting point
 * is unsure, unless the learner starts from nothing or chose to start from scratch. Not on the day
 * the goal was set: the learner just answered placement's questions, so the first session opens
 * with a lesson instead of a review of nothing.
 */
function asksPlacement({ goal, localDate, timeZone }: Omit<BuildContext, "now" | "userId">) {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const created = getDateInTimeZone({ date: goal.createdAt, timeZone });
  const day = daysBetween(created, localDate);

  return (
    day >= 1 &&
    day < PLACEMENT_WEEK_DAYS &&
    details.level !== "none" &&
    details.placementDeclined !== true
  );
}

/** The first week's few placement questions, never ones a drill, capsule or checkpoint asks. */
export async function loadSessionPlacement({
  context,
  skills,
  structure,
  used,
}: {
  context: BuildContext;
  skills: GoalSkillNode[];
  structure: ExamStructure | null;
  used: ReadonlySet<string>;
}): Promise<string[]> {
  if (!asksPlacement(context) || skills.length === 0) {
    return [];
  }

  return pickSessionPlacementItems({
    excludeItemIds: used,
    goal: context.goal,
    limit: SESSION_PLACEMENT_QUESTIONS,
    quickFormat: getPlacementQuickFormat(structure),
    skills,
    userId: context.userId,
  });
}
