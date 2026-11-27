import "server-only";
import { type Goal, prisma } from "@zoonk/db";
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
import { findTestedOutItemIds, planRelearn, withoutSkippedAreas } from "./_utils/relearn-plan";
import { type ComputedPlan, type PlanChangeRecord, revalidatePlanTags } from "./_utils/replan";
import { getRelearnPayload, toRelearnChange } from "./bring-back-missed-lessons";
import { withPlanRetry } from "./plan-conflict";
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
    select: { blocks: true },
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
 * yet move earlier, but only while coverage and the phase dates hold. A refused move is tried
 * once more at the next day the learner opens (`catchUp`), which records the mock either way.
 * Returns the moved topics' names.
 */
export async function replanAfterMock({
  catchUp = false,
  goalId,
  mockId,
  now,
  timeZone,
}: {
  catchUp?: boolean;
  goalId: string;
  mockId: string;
  now: Date;
  timeZone: string;
}): Promise<string[]> {
  return withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId, { now, timeZone });

    if (!context || !isPlanReady(context) || context.state.settings.mockReplan?.mockId === mockId) {
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

    const refused = { applied: false, mockId };

    const [baseline, reordered] = await Promise.all([
      planRelearn({
        context,
        ids,
        now,
        openedKeys,
        state: catchUp ? withMockReplan(context.state, refused) : context.state,
      }),
      planRelearn({ context, ids, now, openedKeys, state: withMockReplan(context.state, applied) }),
    ]);

    if (holdsSchedule({ baseline: baseline.computed, computed: reordered.computed })) {
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
    } else if (catchUp) {
      await recordMockReplan({ context, mockReplan: refused });
    }

    return [];
  });
}

/**
 * Opening a new day applies the latest mock the plan hasn't re-planned for: one finished before
 * plans followed mocks, or one whose move was refused when it finished. Once per mock.
 */
export async function catchUpMockReplan({
  goal,
  now,
  timeZone,
}: {
  goal: Pick<Goal, "id" | "kind">;
  now: Date;
  timeZone: string;
}): Promise<void> {
  if (goal.kind !== "exam") {
    return;
  }

  const [plan, latest] = await Promise.all([
    prisma.plan.findUnique({ select: { settings: true }, where: { goalId: goal.id } }),
    findMockToFollow({ goalId: goal.id, now }),
  ]);

  if (!plan || !latest || parsePlanSettings(plan.settings).mockReplan?.mockId === latest.id) {
    return;
  }

  await replanAfterMock({ catchUp: true, goalId: goal.id, mockId: latest.id, now, timeZone });
}
