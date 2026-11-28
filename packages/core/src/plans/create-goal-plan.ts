import "server-only";
import { type PlanSetupTask, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { unpinnedCourseSourceId } from "../goals/course-start-details";
import { type GoalRebuildFollowUp } from "../goals/goal-rebuild-follow-up";
import { getAnsweredQuestions } from "../view-models/onboarding/onboarding-steps";
import { commitPlan } from "./_utils/commit-plan";
import { type PlanContext } from "./_utils/plan-context";
import { getExamTarget } from "./_utils/plan-exam-target";
import { loadPlanAtToken } from "./_utils/plan-token";
import { isPlanUnchanged } from "./_utils/plan-unchanged";
import { ensureQuickBaseLessons, hasQuickBases } from "./_utils/quick-bases";
import { planOnRecommendedBases } from "./_utils/recommended-bases";
import { type ComputedPlan, computePlan } from "./_utils/replan";
import { savePlanPrimaryCourse } from "./_utils/save-plan-primary-course";
import { trackPlanCreated } from "./_utils/track-plan-created";
import { checkNoticeLanding, getNoticeWaitEnd } from "./notice-wait";
import { withPlanRetry } from "./plan-conflict";
import { listPlanSetupTasks } from "./plan-setup";
import { followNoticeGraph } from "./planner/follow-notice-graph";
import { toIsoDate } from "./planner/plan-calendar";
import { type PlanGraph, parsePlanSettings, planGraphSchema } from "./planner/plan-state";

const MINUTES_PER_HOUR = 60;

type Provenance = { generatedAt: Date; model: string; promptVersion: string; runId: string };

export type GoalPlanCreation = {
  setupTasks: PlanSetupTask[];
  status: "created" | "notFound" | "unchanged";
};

async function keepKnownSkills({
  editionCandidate: _previous,
  ...graph
}: PlanGraph): Promise<PlanGraph> {
  const known = await prisma.skill.findMany({
    select: { id: true },
    where: { id: { in: graph.skills.map((skill) => skill.skillId) } },
  });

  const ids = new Set(known.map((skill) => skill.id));
  return { ...graph, skills: graph.skills.filter((skill) => ids.has(skill.skillId)) };
}

type GraphPlanning = {
  droppedNoticeSkillIds: readonly string[];
  membersMark: { membersCheckedAt?: Date | null };
  primaryCourseId?: string;
  followUp?: GoalRebuildFollowUp;
  followNotice: boolean;
  goalId: string;
  graph: PlanGraph;
  provenance: Provenance | null;
  waitsForNotice: boolean;
};

async function planFromGraph({
  droppedNoticeSkillIds,
  followUp,
  membersMark,
  primaryCourseId,
  followNotice,
  goalId,
  graph,
  provenance,
  waitsForNotice,
}: GraphPlanning) {
  const context = await loadPlanAtToken(goalId);

  if (!context) {
    return null;
  }

  const { goal } = context;
  const { id: planId, version } = context.plan;
  const isFirst = context.state.graph.skills.length === 0;

  const [target, skills] = await Promise.all([
    getExamTarget({
      followNotice,
      goal,
      noticeDate: context.state.settings.noticeDate,
      today: toIsoDate(context.today),
    }),
    keepKnownSkills(graph),
  ]);

  const firstCoursePlan =
    isFirst || (graph.editionCandidate && context.state.graph.editionCandidate);

  const reading = followNotice
    ? followNoticeGraph({
        askedExtras: context.state.settings.extras,
        current: context.state.graph,
        droppedIds: new Set(droppedNoticeSkillIds),
        graph: skills,
      })
    : skills;

  const state = {
    goal: { ...context.state.goal, targetDate: target.targetDate },
    graph:
      firstCoursePlan && !followUp && unpinnedCourseSourceId(goal)
        ? { ...reading, editionCandidate: true }
        : reading,
    settings: { ...context.state.settings, noticeDate: target.noticeDate },
  };

  const planned = await computePlan({ context, mode: "forced", state });

  const computed = isFirst ? await planOnRecommendedBases({ computed: planned, context }) : planned;

  if (
    !isFirst &&
    (!primaryCourseId || primaryCourseId === goal.primaryCourseId) &&
    isPlanUnchanged({ computed, context })
  ) {
    await prisma.plan.updateMany({ data: membersMark, where: { id: planId, version } });
    return { computed, goal, isFirst, status: "unchanged" as const };
  }

  const answered = getAnsweredQuestions(isJsonObject(goal.details) ? goal.details : {});

  const setupTasks: PlanSetupTask[] = isFirst
    ? [
        "placement",
        ...(answered.includes("schedule") ? [] : (["routine"] as const)),
        ...(target.asksNotice ? (["notice"] as const) : []),
      ]
    : [];

  const plan = {
    ...provenance,
    ...membersMark,
    ...(isFirst ? { setupTasks } : {}),
    ...(isFirst && waitsForNotice ? { noticeWaitUntil: getNoticeWaitEnd(new Date()) } : {}),
  };

  await commitPlan({
    change: null,
    computed,
    context,
    extraWrites: async (tx) => {
      if (followUp) {
        const owed = await tx.followUp.findUnique({ where: { id: followUp.id } });

        if (owed?.revision !== followUp.revision) {
          throw new Error("A newer content-country change replaced this curriculum rebuild.");
        }
      }

      await savePlanPrimaryCourse({
        goal,
        graph: computed.state.graph,
        isFirst,
        primaryCourseId,
        tx,
      });

      if (followNotice) {
        await checkNoticeLanding(tx, context.plan.id);
      }

      if (Object.keys(plan).length > 0) {
        await tx.plan.update({ data: plan, where: { id: context.plan.id } });
      }
    },
  });

  return { computed, goal, isFirst, status: "created" as const };
}

function hasFinishedLessons(context: PlanContext): boolean {
  return context.items.some((item) => item.kind === "lesson" && item.status === "done");
}

async function planAgainFromSaved(goalId: string): Promise<ComputedPlan | null> {
  const saved = await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } });
  const settings = parsePlanSettings(saved?.settings);

  if (hasQuickBases(settings)) {
    await ensureQuickBaseLessons(settings);
  }

  return withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId);

    if (!(context && (hasQuickBases(context.state.settings) || hasFinishedLessons(context)))) {
      return null;
    }

    const computed = await computePlan({ context, mode: "forced" });

    if (isPlanUnchanged({ computed, context })) {
      return null;
    }

    await commitPlan({ change: null, computed, context });
    return computed;
  });
}

/**
 * Throws a plan conflict (`isPlanConflictError`) when other writes keep landing while it plans, for
 * the caller to try again later. Applies none of a new plan's setup: it returns the tasks still owed,
 * also when the plan was already built, for the goal's run to apply.
 */
export async function createGoalPlan({
  droppedNoticeSkillIds = [],
  followUp,
  membersCheckedAt,
  primaryCourseId,
  followNotice = false,
  fromPlanLink = false,
  goalId,
  graph,
  platform,
  provenance = null,
  waitsForNotice = false,
}: {
  droppedNoticeSkillIds?: readonly string[];
  /**
   * The notice was read before the learner saw the plan, so a date taken from it follows its new
   * day.
   */
  followNotice?: boolean;
  followUp?: GoalRebuildFollowUp;
  /** Null leaves the graph's member check owed to the daily sweep; omitted keeps the plan's mark. */
  membersCheckedAt?: Date | null;
  primaryCourseId?: string;
  fromPlanLink?: boolean;
  goalId: string;
  graph: PlanGraph;
  platform?: AnalyticsPlatform | null;
  provenance?: Provenance | null;
  /**
   * Built before research read the exam's notice: the new plan reads as waiting for that reading
   * from the write that makes it ready, so no reveal shows it first.
   */
  waitsForNotice?: boolean;
}): Promise<GoalPlanCreation> {
  const goal = await prisma.goal.findUnique({ select: { id: true }, where: { id: goalId } });

  if (!goal) {
    return { setupTasks: [], status: "notFound" };
  }

  // Not an upsert: Prisma's upsert reads first, so a concurrent run's insert would fail it.
  await prisma.plan.createMany({ data: [{ goalId }], skipDuplicates: true });

  const built = await withPlanRetry(() =>
    planFromGraph({
      droppedNoticeSkillIds,
      followNotice,
      followUp,
      goalId,
      graph: planGraphSchema.parse(graph),
      membersMark: membersCheckedAt === undefined ? {} : { membersCheckedAt },
      primaryCourseId,
      provenance,
      waitsForNotice,
    }),
  );

  if (!built) {
    return { setupTasks: [], status: "notFound" };
  }

  const settled = await planAgainFromSaved(goalId);

  if (built.status === "created" && built.isFirst) {
    const final = settled ?? built.computed;

    await trackPlanCreated({
      estimateHours: final.built.estimate.totalMinutes / MINUTES_PER_HOUR,
      fromPlanLink,
      goal: built.goal,
      phases: final.built.phases.length,
      platform,
    });
  }

  return {
    setupTasks: await listPlanSetupTasks(goalId),
    status: built.status === "created" || settled ? "created" : "unchanged",
  };
}
