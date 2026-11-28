import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { type findActiveSubscription } from "../../auth/subscription";
import { isInFinalStretch } from "../../exams/final-stretch/final-stretch-rules";
import { type GoalPlan, type GoalSkillNode } from "../../learner/_utils/goal-skill-graph";
import { loadSkippedRecheckSkills } from "../../learner/_utils/load-skill-claims";
import { type ClaimEvent, listSkippedRechecks } from "../../learner/_utils/skill-claims";
import { type readPracticeMistakes } from "../../learner/facts/practice-mistakes";
import { type readScheduledAnswers } from "../../learner/facts/scheduled-answers";
import { pickSessionChecks } from "../../learner/placement/_utils/session-placement-items";
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
import { type loadLivingPlanSignals } from "./living-plan-session";

export type SessionDayContext = {
  /** The goal's exam blueprint when a GET already read it; without it, it's read fresh. */
  blueprint?: ExamBlueprint | null;
  goal: Goal;
  localDate: Date;
  now: Date;
  /** A GET's request-wide claim events; without it, they're read fresh. */
  readClaims?: (skillIds: readonly string[]) => Promise<ClaimEvent[]>;
  readDayMistakes?: () => ReturnType<typeof readPracticeMistakes>;
  /** A GET passes `readActiveSubscription`; without it, the subscription is read fresh. */
  readSubscription?: typeof findActiveSubscription;
  readWritingAnswers?: typeof readScheduledAnswers;
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
function asksPlacement(day: PlacementDay & { goal: Pick<Goal, "kind"> }) {
  if (getDay(day) < 1) {
    return false;
  }

  return day.goal.kind === "exam" ? readSessionQuestions(day) === "on" : isPlacementWeek(day);
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

async function readRechecks({
  context,
  skillIds,
}: {
  context: BuildContext;
  skillIds: readonly string[];
}): Promise<Set<string>> {
  if (skillIds.length === 0) {
    return new Set();
  }

  const { localDate, readClaims } = context;

  return readClaims
    ? listSkippedRechecks({ events: await readClaims(skillIds), localDate })
    : loadSkippedRecheckSkills({
        goalId: context.goal.id,
        localDate,
        skillIds,
        userId: context.userId,
      });
}

/** Excludes questions used elsewhere today and days with no remaining lessons to place. */
export async function loadSessionPlacement({
  context,
  isReviewDay,
  plan,
  signals,
  used,
}: {
  context: BuildContext;
  isReviewDay: boolean;
  plan: {
    finalStretchStart: Date | null;
    goalPlan?: GoalPlan;
    graph: PlanGraph;
    listeningSkillIds: ReadonlySet<string>;
    settings: unknown;
    skills: GoalSkillNode[];
    structure: ExamStructure | null;
  };
  signals: Awaited<ReturnType<typeof loadLivingPlanSignals>>;
  used: ReadonlySet<string>;
}): Promise<{ placementItemIds: string[]; placementRecheckItemIds: string[] }> {
  const { finalStretchStart, graph, skills, structure } = plan;
  const empty = { placementItemIds: [], placementRecheckItemIds: [] };

  if (skills.length === 0) {
    return empty;
  }

  const skipped = new Set(
    (plan.goalPlan?.items ?? []).flatMap((item) =>
      item.status === "testedOut" ? item.skillIds : [],
    ),
  );

  const skillIds = skills
    .filter((skill) => !skill.removed && skipped.has(skill.id))
    .map((skill) => skill.id);

  const recheckOnly =
    !asksPlacement(context) || placesNothing({ context, finalStretchStart, isReviewDay });

  const practiceRechecks = await readRechecks({ context, skillIds });
  const recheckSkillIds = new Set([...signals.hardRecheckSkillIds, ...practiceRechecks]);

  if (recheckOnly && recheckSkillIds.size === 0 && signals.easySkillIds.length === 0) {
    return empty;
  }

  const settings = parsePlanSettings(plan.settings);

  return pickSessionChecks({
    areaShares: structure ? getAreaShares({ graph, structure }) : null,
    blueprint: context.blueprint,
    easySkillIds: signals.easySkillIds,
    excludeItemIds: used,
    focusAreas: settings.focusAreas,
    goal: context.goal,
    limit: SESSION_PLACEMENT_QUESTIONS,
    listeningSkillIds: plan.listeningSkillIds,
    quickFormat: getPlacementQuickFormat(structure),
    recheckOnly,
    recheckSkillIds,
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
