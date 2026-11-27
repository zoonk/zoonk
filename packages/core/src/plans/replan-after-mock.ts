import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { loadSkillsToRelearn } from "../learner/_utils/load-skill-claims";
import { readBlockPayload } from "../sessions/block-payload";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { markPlanWrite } from "./_utils/mark-plan-write";
import { findMockToFollow, loadMockMisses } from "./_utils/mock-misses";
import { holdsSchedule } from "./_utils/mock-replan-guard";
import { changedSchedule, listEarlierMissedTopics } from "./_utils/mock-replan-moves";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext } from "./_utils/plan-context";
import { writePlanMetadata } from "./_utils/plan-metadata-write";
import { loadPlanAtToken } from "./_utils/plan-token";
import {
  compareMockRelearnPlans,
  findTestedOutItemIds,
  planRelearn,
  withoutSkippedAreas,
} from "./_utils/relearn-plan";
import { type ComputedPlan, type PlanChangeRecord, revalidatePlanTags } from "./_utils/replan";
import { getRelearnPayload, toRelearnChange } from "./bring-back-missed-lessons";
import { withPlanRetry } from "./plan-conflict";
import { addDays } from "./planner/plan-calendar";
import { type PlanSettings, type PlanState, parsePlanSettings } from "./planner/plan-state";

/** For logs and admin only; Today never shows it and the apps don't word it. */
const MOCK_REORDER_NOTE = "A finished mock moved the topics it missed earlier in the plan.";

type MockReplan = NonNullable<PlanSettings["mockReplan"]>;

type RelearnPlan = Awaited<ReturnType<typeof planRelearn>>;

function withMockReplan(state: PlanState, mockReplan: MockReplan): PlanState {
  return { ...state, settings: { ...state.settings, mockReplan } };
}

/**
 * The topics the mock didn't get right that the learner was taken to know without studying them.
 * Claims never read mock answers, so this reads the same once the mock is graded as before it.
 */
async function loadMockRelearnSkillIds({
  context,
  mockId,
}: {
  context: PlanContext;
  mockId: string;
}): Promise<string[]> {
  const attempts = await prisma.attempt.findMany({
    select: { isCorrect: true, skillId: true },
    where: { mockExamId: mockId },
  });

  const skillIds = (right?: boolean) => [
    ...new Set(
      attempts.flatMap((attempt) =>
        attempt.skillId && (right === undefined || attempt.isCorrect === right)
          ? [attempt.skillId]
          : [],
      ),
    ),
  ];

  const toRelearn = await loadSkillsToRelearn({
    goalId: context.goal.id,
    skillIds: skillIds(),
    userId: context.goal.userId,
  });

  return skillIds(false).filter((skillId) => toRelearn.has(skillId));
}

/** The plan items of the day the learner opened, so the re-plan starts from the next one. */
async function loadOpenedKeys(context: PlanContext): Promise<string[] | undefined> {
  const opened = await prisma.studySession.findUnique({
    select: { blocks: { orderBy: { position: "asc" } } },
    where: {
      userGoalDate: {
        goalId: context.goal.id,
        localDate: context.today,
        userId: context.goal.userId,
      },
    },
  });

  return opened?.blocks.flatMap((block) => readBlockPayload(block).planItemKey ?? []);
}

function getReorderChange(computed: ComputedPlan): PlanChangeRecord {
  return {
    kind: "mockReordered",
    payload: toPlanChangePayload({ effect: computed.effect, source: "system" }),
    reason: MOCK_REORDER_NOTE,
    status: "applied",
  };
}

async function recordMockReplan({
  context,
  mockReplan,
}: {
  context: PlanContext;
  mockReplan: MockReplan;
}): Promise<void> {
  await writePlanMetadata({
    context,
    write: async (tx) => {
      await markPlanWrite(tx, context.plan);

      await tx.plan.update({
        data: { settings: withMockReplan(context.state, mockReplan).settings },
        where: { id: context.plan.id },
      });
    },
  });

  revalidatePlanTags(context.goal.userId);
}

async function commitReplan({
  change,
  computed,
  context,
  mockId,
  movedTopics = [],
  restored,
  restoredIds,
}: {
  change: PlanChangeRecord;
  computed: ComputedPlan;
  context: PlanContext;
  mockId: string;
  movedTopics?: string[];
  restored: PlanContext;
  restoredIds: ReadonlySet<string>;
}): Promise<void> {
  await commitPlan({
    change,
    computed,
    context: restored,
    extraWrites: async (tx) => {
      if (restoredIds.size > 0) {
        await tx.planItem.updateMany({
          data: { completedAt: null, status: "todo" },
          where: { id: { in: [...restoredIds] }, planId: context.plan.id, status: "testedOut" },
        });
      }

      if (movedTopics.length > 0) {
        await tx.$executeRaw`
          UPDATE mock_exams
          SET result = result || jsonb_build_object('movedTopics', ${movedTopics}::text[])
          WHERE id = ${mockId}::uuid AND goal_id = ${context.goal.id}::uuid
        `;
      }
    },
    phaseDates: { mode: "forced", pace: "saved" },
    snapshotContext: context,
  });
}

/**
 * Re-plans from the next day when a mock finishes, in one plan write: the lessons of topics taken as
 * known that it missed come back (relearn), and the topics it missed that the plan hasn't taught
 * yet move earlier within the same selected work and schedule limits. A refused move records
 * nothing, so each new day the learner opens tries it again while the mock is the one to follow.
 * Returns the moved topics' names.
 */
export async function replanAfterMock({
  goalId,
  mockId,
  now,
  timeZone,
}: {
  goalId: string;
  mockId: string;
  now: Date;
  timeZone: string;
}): Promise<string[]> {
  return withPlanRetry(async () => {
    const [context, latest] = await Promise.all([
      loadPlanAtToken(goalId, { now, timeZone }),
      findMockToFollow({ goalId, now }),
    ]);

    if (
      latest?.id !== mockId ||
      !context ||
      !isPlanReady(context) ||
      context.state.settings.mockReplan?.mockId === mockId
    ) {
      return [];
    }

    const missed = withoutSkippedAreas({
      skillIds: await loadMockRelearnSkillIds({ context, mockId }),
      state: context.state,
    });

    const [ids, misses, openedKeys] = await Promise.all([
      findTestedOutItemIds({ context, skillIds: new Set(missed) }),
      loadMockMisses(mockId),
      loadOpenedKeys(context),
    ]);

    const applied = { applied: true, mockId };

    const relearn = (planned: RelearnPlan) =>
      getRelearnPayload({ ...planned, graph: context.state.graph, missed });

    if (misses.size === 0) {
      const planned =
        ids.size > 0
          ? await planRelearn({
              context,
              ids,
              now,
              openedKeys,
              state: withMockReplan(context.state, applied),
            })
          : null;

      if (planned && planned.restoredIds.size > 0) {
        await commitReplan({
          ...planned,
          change: toRelearnChange(relearn(planned)),
          context,
          mockId,
        });
      } else {
        await recordMockReplan({ context, mockReplan: applied });
      }

      return [];
    }

    const [baseline, reordered] = await compareMockRelearnPlans({
      context,
      ids,
      misses,
      now,
      openedKeys,
      state: withMockReplan(context.state, applied),
    });

    const movableFrom = openedKeys ? addDays(context.today, 1) : context.today;

    if (holdsSchedule({ baseline: baseline.computed, computed: reordered.computed, movableFrom })) {
      const { computed, restoredIds } = reordered;

      if (restoredIds.size === 0 && !changedSchedule(context, computed)) {
        await recordMockReplan({ context, mockReplan: applied });
        return [];
      }

      const movedTopics = await listEarlierMissedTopics({
        after: computed.built.items,
        before: context.items,
        misses,
        state: context.state,
      });

      const change =
        restoredIds.size > 0 ? toRelearnChange(relearn(reordered)) : getReorderChange(computed);

      await commitReplan({ ...reordered, change, context, mockId, movedTopics });
      return movedTopics;
    }

    if (baseline.restoredIds.size > 0) {
      await commitReplan({
        ...baseline,
        change: toRelearnChange(relearn(baseline)),
        context,
        mockId,
      });
    }

    return [];
  });
}

/**
 * The latest mock the plan hasn't re-planned for: one finished before plans followed mocks, or one
 * whose move was refused when it finished.
 */
async function findMockToCatchUp({
  db = prisma,
  goal,
  now,
}: {
  db?: TransactionClient;
  goal: Pick<Goal, "id" | "kind">;
  now: Date;
}): Promise<{ id: string } | null> {
  if (goal.kind !== "exam") {
    return null;
  }

  const [plan, latest] = await Promise.all([
    db.plan.findUnique({ select: { settings: true }, where: { goalId: goal.id } }),
    findMockToFollow({ db, goalId: goal.id, now }),
  ]);

  return plan && latest && parsePlanSettings(plan.settings).mockReplan?.mockId !== latest.id
    ? latest
    : null;
}

/**
 * Opening a new day owes the re-plan for a mock the plan hasn't followed yet, so the learner never
 * waits for it: the follow-up runs `catchUpMockReplan` once the day is saved as shown.
 */
export async function oweMockCatchUp({
  goal,
  now,
  timeZone,
  tx,
}: {
  goal: Pick<Goal, "id" | "kind" | "userId">;
  now: Date;
  timeZone: string;
  tx: TransactionClient;
}): Promise<void> {
  if (await findMockToCatchUp({ db: tx, goal, now })) {
    await oweFollowUps({
      db: tx,
      followUps: [{ input: { goalId: goal.id, timeZone }, kind: "catchUpMockReplan" }],
      userId: goal.userId,
    });
  }
}

/** Applies the mock `oweMockCatchUp` found, once per mock. */
export async function catchUpMockReplan({
  goalId,
  now = new Date(),
  timeZone,
  userId,
}: {
  goalId: string;
  now?: Date;
  timeZone: string;
  userId: string;
}): Promise<void> {
  const goal = await prisma.goal.findFirst({
    select: { id: true, kind: true },
    where: { id: goalId, userId },
  });

  const latest = goal && (await findMockToCatchUp({ goal, now }));

  if (latest) {
    await replanAfterMock({ goalId, mockId: latest.id, now, timeZone });
  }
}
