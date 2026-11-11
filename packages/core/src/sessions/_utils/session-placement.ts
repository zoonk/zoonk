import { type ExamBlueprint, type Goal } from "@zoonk/db";
import "server-only";
import { type findActiveSubscription } from "../../auth/subscription";
import { isInFinalStretch } from "../../exams/final-stretch/final-stretch-rules";
import { type GoalSkillNode } from "../../learner/_utils/goal-skill-graph";
import { type ClaimEvent } from "../../learner/_utils/skill-claims";
import { loadCurrentTestSummary } from "../../learner/facts/focus-test-summary";
import { pickSessionPlacementItems } from "../../learner/placement/_utils/session-placement-items";
import { listTestSubjects, mapSkillAreas } from "../../learner/placement/focus-test-subjects";
import { readSessionQuestions } from "../../learner/placement/focus-test-summary";
import {
  PLACEMENT_WEEK_DAYS,
  SESSION_PLACEMENT_QUESTIONS,
} from "../../learner/placement/placement-budget";
import { isPlacementSkipped } from "../../learner/placement/placement-contract";
import { getGoalDay } from "../../learner/placement/placement-day";
import { getPlacementQuickFormat } from "../../learner/placement/placement-quick-format";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getAreaShares } from "../../plans/_utils/exam-subject-shares";
import { type PlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";

export type SessionDayContext = {
  /** The goal's exam blueprint when a GET already read it; without it, it's read fresh. */
  blueprint?: ExamBlueprint | null;
  goal: Goal;
  localDate: Date;
  now: Date;
  /** A GET's request-wide claim events; without it, they're read fresh. */
  readClaims?: (skillIds: readonly string[]) => Promise<ClaimEvent[]>;
  /** A GET passes `readActiveSubscription`; without it, the subscription is read fresh. */
  readSubscription?: typeof findActiveSubscription;
  timeZone: string;
  userId: string;
};

type BuildContext = SessionDayContext;

type PlacementDay = Pick<BuildContext, "localDate" | "timeZone"> & {
  goal: Pick<Goal, "createdAt" | "details">;
};

function getDay({ goal, localDate, timeZone }: PlacementDay): number {
  return getGoalDay({ createdAt: goal.createdAt, localDate, timeZone });
}

/** Placement is limited to the first week unless the learner skipped it. */
export function isPlacementWeek(day: PlacementDay): boolean {
  return getDay(day) < PLACEMENT_WEEK_DAYS && !isPlacementSkipped(day.goal);
}

/**
 * Skip goal-creation day: the learner just answered placement, so open with teaching rather than
 * an empty review. An exam goal's sessions follow its Focus test instead of the first week.
 */
async function asksPlacement(day: PlacementDay & { goal: Pick<Goal, "kind" | "id" | "userId"> }) {
  if (getDay(day) < 1) {
    return false;
  }

  return day.goal.kind === "exam"
    ? readSessionQuestions({
        ...day,
        summary: await loadCurrentTestSummary({ goalId: day.goal.id, userId: day.goal.userId }),
      }) === "on"
    : isPlacementWeek(day);
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
    listeningSkillIds: ReadonlySet<string>;
    settings: unknown;
    skills: GoalSkillNode[];
    structure: ExamStructure | null;
  };
  used: ReadonlySet<string>;
}): Promise<string[]> {
  const { finalStretchStart, graph, skills, structure } = plan;

  if (
    !(await asksPlacement(context)) ||
    skills.length === 0 ||
    placesNothing({ context, finalStretchStart, isReviewDay })
  ) {
    return [];
  }

  const settings = parsePlanSettings(plan.settings);

  return pickSessionPlacementItems({
    areaShares: structure ? getAreaShares({ graph, structure }) : null,
    blueprint: context.blueprint,
    excludeItemIds: used,
    focusAreas: settings.focusAreas,
    goal: context.goal,
    limit: SESSION_PLACEMENT_QUESTIONS,
    listeningSkillIds: plan.listeningSkillIds,
    quickFormat: getPlacementQuickFormat(structure),
    skills,
    test:
      context.goal.kind === "exam"
        ? {
            areaOf: mapSkillAreas(graph),
            subjects: listTestSubjects({
              graph,
              listeningSkillIds: plan.listeningSkillIds,
              settings,
              structure,
            }),
            unaskedOnly: getDay(context) >= PLACEMENT_WEEK_DAYS,
          }
        : undefined,
    userId: context.userId,
  });
}
