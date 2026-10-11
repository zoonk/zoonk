import "server-only";
import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isInFinalStretch } from "../../exams/final-stretch/final-stretch-rules";
import { type GoalSkillNode } from "../../learner/_utils/goal-skill-graph";
import { pickSessionPlacementItems } from "../../learner/placement/_utils/session-placement-items";
import {
  PLACEMENT_WEEK_DAYS,
  SESSION_PLACEMENT_QUESTIONS,
} from "../../learner/placement/placement-budget";
import { isPlacementSkipped } from "../../learner/placement/placement-contract";
import { getPlacementQuickFormat } from "../../learner/placement/placement-quick-format";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getAreaShares } from "../../plans/_utils/exam-subject-shares";
import { daysBetween } from "../../plans/planner/plan-calendar";
import { type PlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";

/** The goal, learner and day a session is built for. */
export type SessionDayContext = {
  goal: Goal;
  localDate: Date;
  now: Date;
  timeZone: string;
  userId: string;
};

type BuildContext = SessionDayContext;

type PlacementDay = Pick<BuildContext, "localDate" | "timeZone"> & {
  goal: Pick<Goal, "createdAt" | "details">;
};

function getGoalDay({ goal, localDate, timeZone }: PlacementDay): number {
  return daysBetween(getDateInTimeZone({ date: goal.createdAt, timeZone }), localDate);
}

/**
 * Placement's first week, while the first week's sessions still ask it: unless the learner
 * skipped placement (`isPlacementSkipped`).
 */
export function isPlacementWeek(day: PlacementDay): boolean {
  return getGoalDay(day) < PLACEMENT_WEEK_DAYS && !isPlacementSkipped(day.goal);
}

/**
 * Placement's first week: a goal's sessions ask a few placement questions while a starting point
 * is unsure (see `isPlacementWeek`). Not on the day the goal was set: the learner just answered
 * placement's questions, so the first session opens with a lesson instead of a review of nothing.
 */
function asksPlacement(day: PlacementDay) {
  return getGoalDay(day) >= 1 && isPlacementWeek(day);
}

/**
 * A review day, or a day of the exam's final stretch, has no new lessons left for a placement
 * answer to skip: Pedro's day before opened with "we're adjusting your plan", and his right answer
 * rebuilt his full review.
 */
function placesNothing({
  context,
  finalStretchStart,
  isReviewDay,
}: {
  context: BuildContext;
  finalStretchStart: Date | null;
  isReviewDay: boolean;
}): boolean {
  const { goal, localDate } = context;

  return (
    isReviewDay ||
    isInFinalStretch({ finalStretchStart, targetDate: goal.targetDate, today: localDate })
  );
}

/**
 * The first week's few placement questions, never ones a drill, capsule or checkpoint asks: the
 * areas asked least first, then the learner's weak ones, then the ones worth most of the exam.
 * None on a day with nothing left to place (see `placesNothing`).
 */
export async function loadSessionPlacement({
  context,
  isReviewDay,
  plan,
  used,
}: {
  context: BuildContext;
  /** The day is a review day (the day before a class test, a free plan's mock day). */
  isReviewDay: boolean;
  plan: {
    finalStretchStart: Date | null;
    graph: PlanGraph;
    settings: unknown;
    skills: GoalSkillNode[];
    structure: ExamStructure | null;
  };
  used: ReadonlySet<string>;
}): Promise<string[]> {
  const { finalStretchStart, graph, skills, structure } = plan;

  if (
    !asksPlacement(context) ||
    skills.length === 0 ||
    placesNothing({ context, finalStretchStart, isReviewDay })
  ) {
    return [];
  }

  return pickSessionPlacementItems({
    areaShares: structure ? getAreaShares({ graph, structure }) : null,
    excludeItemIds: used,
    focusAreas: parsePlanSettings(plan.settings).focusAreas,
    goal: context.goal,
    limit: SESSION_PLACEMENT_QUESTIONS,
    quickFormat: getPlacementQuickFormat(structure),
    skills,
    userId: context.userId,
  });
}
