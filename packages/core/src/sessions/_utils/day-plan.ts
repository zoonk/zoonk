import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getExamPrepAccess } from "../../entitlements/limits";
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
import { loadDailyTimeLimitStatus } from "./daily-time-limit";
import { getGoalDayMinutes } from "./day-minutes";
import { loadExamStructure } from "./exam-structure";
import { loadIdleListeningSkillIds } from "./load-practice";
import { getSkippedSkillIds } from "./review-skills";
import { type SelectedDayPlan } from "./selected-day-plan";
import { type SessionDayContext } from "./session-placement";
import { type SessionPlanItem } from "./session-plan-item";

/** Whether the goal had a day before this one: day one starts nothing over. */
async function hasEarlierDay({ goalId, today }: { goalId: string; today: Date }) {
  const earlier = await prisma.studySession.findFirst({
    select: { id: true },
    where: { goalId, localDate: { lt: today } },
  });

  return earlier !== null;
}

async function loadLastStudyDate({ today, userId }: { today: Date; userId: string }) {
  const day = await prisma.dailyProgress.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
    where: { date: { lt: today }, timeSpentSeconds: { gt: 0 }, userId },
  });

  return day?.date ?? null;
}

/** The plan's first day, or the goal's set-up day in the learner's time zone without one. */
function getPlanStart({
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

/**
 * What a day's session is built from: the goal's plan and its skills, but those of an area the
 * learner took out (out by choice: nothing asks them, even one a test-out left a row of in the
 * plan), what each skill builds on, the exam's structure, and the learner's day. The listening
 * skills with no voiced recording to ask today (`idleSkillIds`) leave their subject's time to the
 * others.
 */
export async function loadDayPlan({
  goal,
  localDate,
  now,
  selection,
  timeZone,
  userId,
}: SessionDayContext & { selection?: SelectedDayPlan }) {
  const [plan, goalPlan, tier, limit, lastStudyDate, hadEarlierDay, listeningSkillIds] =
    await Promise.all([
      selection
        ? {
            graph: selection.state.graph,
            items: selection.items,
            phases: selection.phases,
            settings: selection.state.settings,
          }
        : prisma.plan.findUnique({
            include: { items: { orderBy: { position: "asc" } } },
            where: { goalId: goal.id },
          }),
      loadGoalPlan(goal.id, selection?.source),
      getLearnerTier(userId),
      loadDailyTimeLimitStatus({ date: localDate, userId }),
      loadLastStudyDate({ today: localDate, userId }),
      hasEarlierDay({ goalId: goal.id, today: localDate }),
      selection
        ? loadGoalListeningSkillIds({ goal, graph: selection.state.graph })
        : loadListeningSkillIds(goal.id),
    ]);

  // The day's mock fits the day: a class test's short mock takes the time the learner gives it.
  const dayMinutes = getGoalDayMinutes({ date: localDate, goal, planSettings: plan?.settings });
  const items: SessionPlanItem[] = plan?.items ?? [];
  const graph = parsePlanGraph(plan?.graph);
  const skipped = getSkippedSkillIds({ graph, settings: plan?.settings });
  const skills = goalPlan.skills.filter((skill) => !skipped.has(skill.id));

  const [structure, prerequisites, idleSkillIds] = await Promise.all([
    loadExamStructure(goal, { dayMinutes }),
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
    /** What exam prep the learner's plan (Plus, free or guest) covers. */
    examPrep: getExamPrepAccess(tier),
    finalStretchStart: getFinalStretchStart(parsePlanPhases(plan?.phases)),
    goalPlan,
    graph,
    idleSkillIds,
    isFirstDay: !hadEarlierDay,
    /** Each plan item's skills, by its id: what a phase's lessons study (`getBossSkillIds`). */
    itemSkillIds: new Map(goalPlan.items.map((item) => [item.id, item.skillIds])),
    items,
    lastStudyDate,
    limit,
    listeningSkillIds,
    /** Where the days away count from when the learner hasn't studied since (see `getFreshStart`). */
    planStart: getPlanStart({ goal, settings: plan?.settings, timeZone }),
    prerequisites,
    settings: plan?.settings ?? null,
    skills,
    structure,
    // Weekly challenges ask single questions, so an exam's listening skills, practiced only with
    // recordings, aren't theirs (a boss plays a listening phase's recordings, a review one of them).
    textSkillIds: skills.flatMap((skill) => (listeningSkillIds.has(skill.id) ? [] : [skill.id])),
    tier,
  };
}
