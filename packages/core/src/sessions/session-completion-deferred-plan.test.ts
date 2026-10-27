import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as logger from "@zoonk/utils/logger";
import { after } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import * as preparation from "../preparation/rebalance-plan";
import * as planRefresh from "./_utils/refresh-plan";
import { answerStudyQuestion } from "./answer-study-question";
import { toBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";
import { startStudyBlock } from "./start-study-block";

/** Observe real refresh calls; only Next's request-lifetime boundary is held by the test. */
function holdDeferredWork() {
  const work: Parameters<typeof after>[0][] = [];
  vi.mocked(after).mockImplementation((task) => work.push(task));

  return {
    clear: () => {
      void work.splice(0);
    },
    run: async () => {
      await Promise.all(work.splice(0).map((task) => (typeof task === "function" ? task() : task)));
    },
  };
}

async function finishPractice({
  goalId,
  itemId,
  skillId,
  userId,
}: {
  goalId?: string;
  itemId: string;
  skillId: string;
  userId: string;
}) {
  const session = await studySessionFixture({ goalId, plannedMinutes: 3, userId });

  const block = await studySessionBlockFixture({
    estimatedMinutes: 3,
    kind: "practice",
    payload: toBlockPayload({ itemIds: [itemId], skillIds: [skillId] }),
    sessionId: session.id,
  });

  await startStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id });

  await answerStudyQuestion({
    blockId: block.id,
    input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId, timeZone: "UTC" },
    sessionId: session.id,
  });

  return { block, session };
}

function readPlan(planId: string) {
  return prisma.plan.findUniqueOrThrow({
    include: { changes: { orderBy: { id: "asc" } }, items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });
}

async function plannedPractice() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));

  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 8 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 10,
    details: { placementDeclined: true },
    settings: { startDate: "2026-09-28" },
    targetDate: new Date("2026-10-30"),
    timezone: "UTC",
    userId: user.id,
  });

  mockSession(user.id);

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  const skillId = library.skills[0]?.id ?? "";
  const item = await itemFixture({ content: choiceItemContent(), skillId });

  const practice = await finishPractice({
    goalId: goal.id,
    itemId: item.id,
    skillId,
    userId: user.id,
  });

  return { ...practice, goal, plan, user };
}

/** A real settings writer holds the canonical plan/user locks while the background reads its old version. */
async function holdCalendarWrite({ goalId, userId }: { goalId: string; userId: string }) {
  const release = Promise.withResolvers<null>();
  const ready = Promise.withResolvers<number>();

  const held = prisma.$transaction(
    async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId });
      await tx.goal.update({ data: { dailyMinutes: 20 }, where: { id: goalId } });
      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      ready.resolve(connection?.pid ?? 0);
      await release.promise;
    },
    { timeout: 12_000 },
  );

  const settled = Promise.allSettled([held]);
  void held.catch(ready.reject);
  return { pid: await ready.promise, release: release.resolve, settled };
}

async function waitForPlanWriter(holderPid: number) {
  await expect
    .poll(
      () => prisma.$queryRaw<{ pid: number }[]>`
        SELECT pid FROM pg_stat_activity
        WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))
          AND query ~* 'plans.*FOR UPDATE'
      `,
      { interval: 10, timeout: 4000 },
    )
    .not.toHaveLength(0);
}

describe("the completion moment precedes replanning", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(after).mockReset();
    vi.useRealTimers();
  });

  it("commits completion and its ledger before running the deferred plan work", async () => {
    const deferred = holdDeferredWork();
    const refresh = vi.spyOn(planRefresh, "refreshPlanAroundSession");
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
    const session = await studySessionFixture({ plannedMinutes: 3, userId: user.id });

    const block = await studySessionBlockFixture({
      estimatedMinutes: 3,
      kind: "practice",
      payload: toBlockPayload({ itemIds: [item.id], skillIds: [skill.id] }),
      sessionId: session.id,
    });

    mockSession(user.id);

    await expect(
      startStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      answerStudyQuestion({
        blockId: block.id,
        input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId: item.id, timeZone: "UTC" },
        sessionId: session.id,
      }),
    ).resolves.toMatchObject({ status: "ready" });

    deferred.clear();
    refresh.mockClear();

    const result = await finishStudyBlock({
      blockId: block.id,
      input: { timeZone: "UTC" },
      sessionId: session.id,
    });

    expect(result).toMatchObject({ completion: { sessionCompleted: true }, status: "ready" });
    expect(refresh).not.toHaveBeenCalled();

    const saved = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    expect(saved.status).toBe("completed");
    expect(saved.endedAt).not.toBeNull();
    expect(saved.endSnapshot).not.toBeNull();

    const ledger = await prisma.learningEvent.findFirstOrThrow({
      where: {
        contentIds: { equals: session.id, path: ["studySessionId"] },
        kind: "session",
        userId: user.id,
      },
    });

    expect(ledger.endedAt).toStrictEqual(saved.endedAt);

    await deferred.run();

    expect(refresh).toHaveBeenCalledExactlyOnceWith({
      goalId: null,
      pace: "sampled",
      retryOnConflict: false,
      revalidation: "skip",
    });
  });

  it("a later read observes the real plan committed by deferred settling", async () => {
    const deferred = holdDeferredWork();
    const refresh = vi.spyOn(planRefresh, "refreshPlanAroundSession");
    const { block, goal, plan, session } = await plannedPractice();

    const before = await readPlan(plan.id);

    expect(
      before.items.some(
        (entry) =>
          entry.status === "todo" &&
          entry.scheduledFor &&
          entry.scheduledFor < new Date("2026-09-30"),
      ),
    ).toBe(true);

    deferred.clear();
    refresh.mockClear();

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ completion: { sessionCompleted: true }, status: "ready" });

    expect(refresh).not.toHaveBeenCalled();

    await expect(readPlan(plan.id)).resolves.toStrictEqual({
      ...before,
      // Block completion and session completion each mark their own transaction.
      inputVersion: before.inputVersion + 2,
    });

    await deferred.run();

    expect(refresh).toHaveBeenCalledExactlyOnceWith({
      goalId: goal.id,
      pace: "sampled",
      retryOnConflict: false,
      revalidation: "skip",
    });

    const saved = await readPlan(plan.id);
    expect(saved.version).toBeGreaterThan(before.version);
    expect(saved.inputVersion).toBeGreaterThan(before.inputVersion);

    const change = saved.changes.findLast(
      (entry) => entry.kind === "missedDays" && entry.status === "applied",
    );

    expect(change).toBeDefined();
    const read = await getGoalPlan(goal.id);

    if (read.status !== "ready") {
      throw new Error("Expected the actual refreshed owned plan");
    }

    expect(read.plan.changes.map((entry) => entry.id)).toContain(change?.id);
    await expect(readPlan(plan.id)).resolves.toStrictEqual(saved);
  });

  it("logs one lost CAS and leaves the winning calendar and plan untouched", async () => {
    const deferred = holdDeferredWork();
    const refresh = vi.spyOn(planRefresh, "refreshPlanAroundSession");
    const rebalance = vi.spyOn(preparation, "rebalancePlanAfterSession");
    const error = vi.spyOn(logger, "logError");
    const { block, goal, plan, session, user } = await plannedPractice();
    deferred.clear();
    refresh.mockClear();

    await expect(
      finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ completion: { sessionCompleted: true }, status: "ready" });

    const before = await readPlan(plan.id);
    const winner = await holdCalendarWrite({ goalId: goal.id, userId: user.id });
    const background = deferred.run();

    try {
      await waitForPlanWriter(winner.pid);
    } finally {
      winner.release(null);
    }

    await expect(winner.settled).resolves.toMatchObject([{ status: "fulfilled" }]);
    await background;

    expect(refresh).toHaveBeenCalledOnce();
    expect(rebalance).not.toHaveBeenCalled();

    expect(error).toHaveBeenCalledExactlyOnceWith(
      `Could not refresh the plan of goal ${goal.id}.`,
      expect.objectContaining({ name: "PlanConflictError" }),
    );

    const saved = await readPlan(plan.id);
    expect(saved).toStrictEqual({ ...before, inputVersion: before.inputVersion + 1 });

    const read = await getGoalPlan(goal.id);
    expect(read).toMatchObject({ plan: { schedule: { dailyMinutes: 20 } }, status: "ready" });
    await expect(readPlan(plan.id)).resolves.toStrictEqual(saved);
  });
});
