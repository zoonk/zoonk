import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getExamPrepAccess } from "../../entitlements/limits";
import { readExamPicks } from "../../exams/choices/exam-choices";
import { getFinalStretchStart } from "../../exams/final-stretch/final-stretch-rules";
import {
  loadGoalListeningSkillIds,
  loadListeningSkillIds,
} from "../../exams/listening/listening-skills";
import { loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { getLearnerTier } from "../../lookahead/learner-lookahead";
import { fromIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanGraph, parsePlanPhases, parsePlanSettings } from "../../plans/planner/plan-state";
import { getGoalDayMinutes } from "./day-minutes";
import { getSessionChallenges } from "./day-stretch";
import { loadExamStructure } from "./exam-structure";
import { putLeftWorkFirst } from "./left-work-first";
import { loadIdleListeningSkillIds } from "./load-practice";
import { getDayOutlines } from "./outlining-stand-ins";
import { type SelectedDayPlan } from "./selected-day-plan";
import { type SessionDayContext } from "./session-placement";
import { type SessionPlanItem } from "./session-plan-item";

function loadPreviousSession({
  goalId,
  today,
  userId,
}: {
  goalId: string;
  today: Date;
  userId: string;
}) {
  return prisma.studySession.findFirst({
    orderBy: { localDate: "desc" },
    select: {
      blocks: { select: { payload: true, startedAt: true }, where: { kind: "checkpoint" } },
      localDate: true,
    },
    where: { goalId, localDate: { lt: today }, userId },
  });
}

async function loadLastStudyDate({ today, userId }: { today: Date; userId: string }) {
  const day = await prisma.dailyProgress.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
    where: { date: { lt: today }, timeSpentSeconds: { gt: 0 }, userId },
  });

  return day?.date ?? null;
}

export function getPlanStart({
  goal,
  settings,
  timeZone,
}: {
  goal: Pick<Goal, "createdAt">;
  settings: unknown;
  timeZone: string;
}): Date {
  const { startDate } = parsePlanSettings(settings);
  return startDate ? fromIsoDate(startDate) : getDateInTimeZone({ date: goal.createdAt, timeZone });
}

function readSessionPlan({ goalId, selection }: { goalId: string; selection?: SelectedDayPlan }) {
  return selection
    ? Promise.resolve({
        graph: selection.state.graph,
        items: selection.items,
        lessonsAskedAt: selection.context.plan.lessonsAskedAt,
        phases: selection.phases,
        settings: selection.state.settings,
      })
    : prisma.plan.findUnique({
        include: { items: { orderBy: { position: "asc" } } },
        where: { goalId },
      });
}

/** Excludes learner-removed areas; idle listening skills release their allocation to other subjects. */
export async function loadDayPlan({
  blueprint,
  goal,
  localDate,
  now,
  readSubscription,
  selection,
  timeZone,
  userId,
}: SessionDayContext & { selection?: SelectedDayPlan }) {
  const readPlan = readSessionPlan({ goalId: goal.id, selection });

  const [plan, goalPlan, tier, lastStudyDate, previousSession, listeningSkillIds, outlines] =
    await Promise.all([
      readPlan,
      loadGoalPlan(goal.id, selection?.source),
      getLearnerTier(userId, readSubscription),
      loadLastStudyDate({ today: localDate, userId }),
      loadPreviousSession({ goalId: goal.id, today: localDate, userId }),
      selection
        ? loadGoalListeningSkillIds({ blueprint, goal, graph: selection.state.graph })
        : loadListeningSkillIds(goal.id),
      readPlan.then((saved) => getDayOutlines({ goal, localDate, now, plan: saved })),
    ]);

  const dayMinutes = getGoalDayMinutes({ date: localDate, goal, planSettings: plan?.settings });
  const graph = parsePlanGraph(plan?.graph);
  const phases = parsePlanPhases(plan?.phases);
  const skills = goalPlan.skills.filter((skill) => !skill.removed);

  const [structure, prerequisites, idleSkillIds] = await Promise.all([
    loadExamStructure(goal, { blueprint, dayMinutes, picks: readExamPicks(plan?.settings) }),
    loadSkillPrerequisites(graph.skills.map((skill) => skill.skillId)),
    loadIdleListeningSkillIds({
      examBlueprintId: goal.examBlueprintId,
      listeningSkillIds,
      now,
      userId,
    }),
  ]);

  return {
    dayMinutes,
    examPrep: getExamPrepAccess(tier),
    finalStretchStart: getFinalStretchStart(phases),
    goalPlan,
    graph,
    idleSkillIds,
    isFirstDay: previousSession === null,
    itemSkillIds: new Map(goalPlan.items.map((item) => [item.id, item.skillIds])),
    items: putLeftWorkFirst<SessionPlanItem>({
      items: plan?.items ?? [],
      left: selection?.left ?? [],
      prerequisites,
    }),
    lastSessionChallenges: getSessionChallenges(previousSession?.blocks ?? []),
    lastStudyDate,
    lessonsAskedAt: plan?.lessonsAskedAt ?? null,
    listeningSkillIds,
    outlines,
    phases,
    /** Where the days away count from when the learner hasn't studied since (see `getFreshStart`). */
    planStart: getPlanStart({ goal, settings: plan?.settings, timeZone }),
    prerequisites,
    previousSessionDate: previousSession?.localDate ?? null,
    settings: plan?.settings ?? null,
    skills,
    structure,
    // Mixed weekly challenges cannot ask listening-only skills without their recordings.
    textSkillIds: skills.flatMap((skill) => (listeningSkillIds.has(skill.id) ? [] : [skill.id])),
    tier,
  };
}
