import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
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

export type SessionDayContext = {
  /** The goal's exam blueprint when a GET already read it; without it, it's read fresh. */
  blueprint?: ExamBlueprint | null;
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

/** Placement is limited to the first week unless the learner skipped it. */
export function isPlacementWeek(day: PlacementDay): boolean {
  return getGoalDay(day) < PLACEMENT_WEEK_DAYS && !isPlacementSkipped(day.goal);
}

/** Skip goal-creation day: the learner just answered placement, so open with teaching rather than an empty review. */
function asksPlacement(day: PlacementDay) {
  return getGoalDay(day) >= 1 && isPlacementWeek(day);
}

/** Review-only days have no new teaching for placement to skip. */
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

/** Excludes questions used elsewhere today and days with no remaining lessons to place. */
export async function loadSessionPlacement({
  context,
  isReviewDay,
  plan,
  used,
}: {
  context: BuildContext;
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
