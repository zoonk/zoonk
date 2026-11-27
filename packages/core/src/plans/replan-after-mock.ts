import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { findMockToFollow, loadMockMisses } from "./_utils/mock-misses";
import { holdsSchedule } from "./_utils/mock-replan-guard";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext } from "./_utils/plan-context";
import { writePlanMetadata } from "./_utils/plan-metadata-write";
import { loadPlanAtToken } from "./_utils/plan-token";
import { findTestedOutItemIds, planRelearn, withoutSkippedAreas } from "./_utils/relearn-plan";
import { type ComputedPlan, type PlanChangeRecord, revalidatePlanTags } from "./_utils/replan";
import { getRelearnPayload, toRelearnChange } from "./bring-back-missed-lessons";
import { withPlanRetry } from "./plan-conflict";
import { LEARN_KINDS } from "./planner/plan-item-rules";
import { type PlanSettings, type PlanState, parsePlanSettings } from "./planner/plan-state";
import { type MockMiss } from "./planner/skill-order";

const MOVED_TOPICS_NAMED = 3;

/** For logs and admin only; Today never shows it and the apps don't word it. */
const MOCK_REORDER_NOTE = "A finished mock moved the topics it missed earlier in the plan.";

type MockReplan = NonNullable<PlanSettings["mockReplan"]>;

type RelearnPlan = Awaited<ReturnType<typeof planRelearn>>;

type DatedItem = Pick<
  PlanContext["items"][number],
  "kind" | "lessonId" | "scheduledFor" | "skillId" | "status"
>;

function withMockReplan(state: PlanState, mockReplan: MockReplan): PlanState {
  return { ...state, settings: { ...state.settings, mockReplan } };
}

async function loadTaughtSkills({
  items,
  skillIds,
}: {
  items: readonly DatedItem[];
  skillIds: readonly string[];
}): Promise<Map<string, string[]>> {
  const lessonIds = [...new Set(items.flatMap((item) => item.lessonId ?? []))];

  const taught = await prisma.lessonSkill.findMany({
    select: { lessonId: true, skillId: true },
    where: { lessonId: { in: lessonIds }, skillId: { in: [...skillIds] } },
  });

  return new Map(
    [...Map.groupBy(taught, (row) => row.lessonId)].map(([lessonId, rows]) => [
      lessonId,
      rows.map((row) => row.skillId),
    ]),
  );
}

function getFirstDates({
  items,
  misses,
  taught,
}: {
  items: readonly DatedItem[];
  misses: ReadonlyMap<string, MockMiss>;
  taught: ReadonlyMap<string, readonly string[]>;
}): Map<string, number> {
  return items.reduce((first, item) => {
    const skillIds = item.lessonId
      ? (taught.get(item.lessonId) ?? [])
      : [item.skillId ?? ""].filter((skillId) => misses.has(skillId));

    const at = item.scheduledFor?.getTime() ?? Infinity;

    skillIds.forEach((skillId) => first.set(skillId, Math.min(at, first.get(skillId) ?? Infinity)));
    return first;
  }, new Map<string, number>());
}

/** The missed topics whose first lesson the re-plan brought forward, soonest first. */
async function listMovedTopics({
  after,
  before,
  misses,
  state,
}: {
  after: readonly DatedItem[];
  before: readonly DatedItem[];
  misses: ReadonlyMap<string, MockMiss>;
  state: PlanState;
}): Promise<string[]> {
  const todo = (items: readonly DatedItem[]) =>
    items.filter((item) => item.status === "todo" && LEARN_KINDS.has(item.kind));

  const [was, now] = [todo(before), todo(after)];
  const taught = await loadTaughtSkills({ items: [...was, ...now], skillIds: [...misses.keys()] });
  const wasFirst = getFirstDates({ items: was, misses, taught });

  const moved = [...getFirstDates({ items: now, misses, taught })]
    .filter(([skillId, at]) => at < (wasFirst.get(skillId) ?? Infinity))
    .toSorted(([, first], [, second]) => first - second);

  const names = new Map(state.graph.skills.map((skill) => [skill.skillId, skill.name]));

  return moved.flatMap(([skillId]) => names.get(skillId) ?? []).slice(0, MOVED_TOPICS_NAMED);
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
    write: (tx) =>
      tx.plan.update({
        data: { settings: withMockReplan(context.state, mockReplan).settings },
        where: { id: context.plan.id },
      }),
  });

  revalidatePlanTags(context.goal.userId);
}

async function commitReplan({
  change,
  computed,
  context,
  restored,
  restoredIds,
}: {
  change: PlanChangeRecord;
  computed: ComputedPlan;
  context: PlanContext;
  restored: PlanContext;
  restoredIds: ReadonlySet<string>;
}): Promise<void> {
  await commitPlan({
    change,
    computed,
    context: restored,
    extraWrites: async (tx) => {
      await tx.planItem.updateMany({
        data: { completedAt: null, status: "todo" },
        where: { id: { in: [...restoredIds] }, planId: context.plan.id, status: "testedOut" },
      });
    },
    phaseDates: { mode: "forced", pace: "saved" },
    snapshotContext: context,
  });
}

/**
 * Re-plans from today when a mock finishes, in one plan write: the lessons of topics taken as
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
  relearnSkillIds = [],
  timeZone,
}: {
  catchUp?: boolean;
  goalId: string;
  mockId: string;
  now: Date;
  relearnSkillIds?: readonly string[];
  timeZone: string;
}): Promise<string[]> {
  return withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId, { now, timeZone });

    if (!context || !isPlanReady(context) || context.state.settings.mockReplan?.mockId === mockId) {
      return [];
    }

    const missed = withoutSkippedAreas({ skillIds: relearnSkillIds, state: context.state });

    const [ids, misses] = await Promise.all([
      findTestedOutItemIds({ context, skillIds: new Set(missed) }),
      loadMockMisses(mockId),
    ]);

    const applied = { applied: true, mockId };

    const relearn = (planned: RelearnPlan) =>
      getRelearnPayload({ ...planned, graph: context.state.graph, missed });

    if (misses.size === 0) {
      const planned =
        ids.size > 0
          ? await planRelearn({ context, ids, now, state: withMockReplan(context.state, applied) })
          : null;

      if (planned && planned.restoredIds.size > 0) {
        await commitReplan({ ...planned, change: toRelearnChange(relearn(planned)), context });
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
        state: catchUp ? withMockReplan(context.state, refused) : context.state,
      }),
      planRelearn({ context, ids, now, state: withMockReplan(context.state, applied) }),
    ]);

    if (holdsSchedule({ baseline: baseline.computed, computed: reordered.computed })) {
      const moved = await listMovedTopics({
        after: reordered.computed.built.items,
        before: context.items,
        misses,
        state: context.state,
      });

      if (reordered.restoredIds.size > 0) {
        await commitReplan({ ...reordered, change: toRelearnChange(relearn(reordered)), context });
      } else if (moved.length > 0) {
        await commitReplan({ ...reordered, change: getReorderChange(reordered.computed), context });
      } else {
        await recordMockReplan({ context, mockReplan: applied });
      }

      return moved;
    }

    if (baseline.restoredIds.size > 0) {
      await commitReplan({ ...baseline, change: toRelearnChange(relearn(baseline)), context });
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
