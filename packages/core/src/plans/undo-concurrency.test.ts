import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { isJsonObject } from "@zoonk/utils/json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { startStudyBlock } from "../sessions/start-study-block";
import { readPlan } from "./_test-utils/kept-end-plan";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { parsePlanSnapshot } from "./_utils/plan-snapshot";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";

const NOW = new Date("2026-09-30T12:00:00Z");

async function setup({ waiting = false } = {}) {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({
      skills: waiting ? [{ lessons: 2 }, { lessons: 0, size: 4 }] : [{ lessons: 12 }],
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: waiting ? 30 : 12,
    settings: { startDate: "2026-09-30" },
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);
  const opened = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
  expect(opened.status).toBe("ready");

  if (opened.status !== "ready") {
    throw new Error(`Expected a ready day, received ${opened.status}`);
  }

  return { day: opened.session, goal, plan };
}

function readDay(sessionId: string) {
  return prisma.studySession.findUniqueOrThrow({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { id: sessionId },
  });
}

async function applyMoreTime(goalId: string) {
  const applied = await changeGoalPlan({
    goalId,
    input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }], timeZone: "UTC" },
  });

  expect(applied.status).toBe("applied");

  if (applied.status !== "applied" || !applied.change) {
    throw new Error("Expected an undoable change");
  }

  return applied.change;
}

function undo({ changeId, goalId }: { changeId: string; goalId: string }) {
  return decidePlanChange({ changeId, goalId, input: { status: "undone", timeZone: "UTC" } });
}

/** Both operations are real calls; a held row makes their ordering observable in Postgres. */
async function holdBlock(blockId: string) {
  const release = Promise.withResolvers<null>();
  const ready = Promise.withResolvers<number>();

  const held = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM study_session_blocks WHERE id = ${blockId}::uuid FOR UPDATE
      `;

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

/** Follow the lock queue too: Undo can wait behind the starter instead of directly on the holder. */
async function waitForWriter({
  holderPid,
  precedingPid = 0,
  operation,
}: {
  holderPid: number;
  precedingPid?: number;
  operation: "start" | "undo";
}) {
  const query =
    operation === "start"
      ? // A starter behind Undo now waits at its revision marker, before domain rows.
        "(UPDATE.*study_session|study_session_blocks.*FOR UPDATE|UPDATE users SET learner_revision)"
      : "(DELETE|FOR UPDATE)";

  await expect
    .poll(
      async () =>
        prisma.$queryRaw<{ pid: number }[]>`
          SELECT pid FROM pg_stat_activity
          WHERE datname = current_database()
            AND pid <> ${holderPid} AND pid <> ${precedingPid}
            AND query ~* ${query}
            AND (${holderPid} = ANY(pg_blocking_pids(pid))
              OR ${precedingPid} = ANY(pg_blocking_pids(pid)))
        `,
      { interval: 10, timeout: 4000 },
    )
    .not.toHaveLength(0);
}

async function blockedStarterPid(holderPid: number) {
  await waitForWriter({ holderPid, operation: "start" });

  const [waiting] = await prisma.$queryRaw<{ pid: number }[]>`
    SELECT pid FROM pg_stat_activity
    WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))
      AND query ~* '(UPDATE.*study_session_blocks|study_session_blocks.*FOR UPDATE)'
  `;

  if (!waiting) {
    throw new Error("Expected the block starter to remain queued");
  }

  return waiting.pid;
}

describe("Undo keeps intervening study and can retry failed restoration", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("preserves an actual block start queued before Undo restores an already active day", async () => {
    const { day, goal, plan } = await setup();
    const shownPlan = await readPlan(plan.id);
    const first = day.blocks[0];
    expect(first).toBeDefined();

    if (!first) {
      throw new Error("Expected the day's first block");
    }

    await expect(
      startStudyBlock({ blockId: first.id, input: { timeZone: "UTC" }, sessionId: day.id }),
    ).resolves.toMatchObject({ status: "ready" });

    const change = await applyMoreTime(goal.id);
    const current = await readDay(day.id);
    const oldIds = new Set(day.blocks.map((block) => block.id));

    const replacement = current.blocks.find(
      (block) =>
        !oldIds.has(block.id) &&
        block.status === "pending" &&
        block.kind === "learn" &&
        day.blocks.some((old) => old.position === block.position),
    );

    if (!replacement) {
      throw new Error("Expected a pending replacement in an original block's position");
    }

    const blocker = await holdBlock(replacement.id);

    const starting = Promise.allSettled([
      startStudyBlock({ blockId: replacement.id, input: { timeZone: "UTC" }, sessionId: day.id }),
    ]);

    const undoing =
      Promise.withResolvers<PromiseSettledResult<Awaited<ReturnType<typeof undo>>>[]>();

    try {
      const starterPid = await blockedStarterPid(blocker.pid);
      const result = Promise.allSettled([undo({ changeId: change.id, goalId: goal.id })]);
      undoing.resolve(result);
      await waitForWriter({ holderPid: blocker.pid, operation: "undo", precedingPid: starterPid });
    } finally {
      blocker.release(null);
      await blocker.settled;
      await starting;
      undoing.resolve([]);
      await undoing.promise;
    }

    const [started] = await starting;
    const [undone] = await undoing.promise;
    expect(started).toMatchObject({ status: "fulfilled", value: { status: "ready" } });

    const undoError = undone?.status === "rejected" ? undone.reason : undefined;
    expect(undoError).toBeUndefined();

    expect(undone).toMatchObject({
      status: "fulfilled",
      value: { change: { status: "undone" }, status: "updated" },
    });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shownPlan);

    const restored = await readDay(day.id);

    const startedBlock =
      started?.status === "fulfilled" && started.value.status === "ready"
        ? started.value.block
        : undefined;

    expect(startedBlock?.startedAt).not.toBeNull();
    expect(restored.status).toBe("active");

    expect(restored.blocks.find((block) => block.id === replacement.id)).toMatchObject({
      startedAt: startedBlock?.startedAt,
      status: "active",
    });

    expect(new Set(restored.blocks.map((block) => block.position)).size).toBe(
      restored.blocks.length,
    );
  });

  it("lets Undo claim a replacement before its start without opening the restored planned day", async () => {
    const { day, goal } = await setup();
    const change = await applyMoreTime(goal.id);
    const current = await readDay(day.id);
    expect(current).toMatchObject({ startedAt: null, status: "planned" });
    const originalIds = new Set(day.blocks.map((block) => block.id));

    const replacement = current.blocks.find(
      (block) => block.kind === "learn" && block.status === "pending" && !originalIds.has(block.id),
    );

    if (!replacement) {
      throw new Error("Expected a replacement the learner has not started");
    }

    const blocker = await holdBlock(replacement.id);
    const undoing = Promise.allSettled([undo({ changeId: change.id, goalId: goal.id })]);

    const starting =
      Promise.withResolvers<PromiseSettledResult<Awaited<ReturnType<typeof startStudyBlock>>>[]>();

    try {
      await waitForWriter({ holderPid: blocker.pid, operation: "undo" });

      const [queuedUndo] = await prisma.$queryRaw<{ pid: number }[]>`
        SELECT pid FROM pg_stat_activity
        WHERE datname = current_database() AND ${blocker.pid} = ANY(pg_blocking_pids(pid))
          AND query ~* '(DELETE|FOR UPDATE)'
      `;

      if (!queuedUndo) {
        throw new Error("Expected Undo to remain queued on the held replacement");
      }

      starting.resolve(
        Promise.allSettled([
          startStudyBlock({
            blockId: replacement.id,
            input: { timeZone: "UTC" },
            sessionId: day.id,
          }),
        ]),
      );

      await waitForWriter({
        holderPid: blocker.pid,
        operation: "start",
        precedingPid: queuedUndo.pid,
      });
    } finally {
      blocker.release(null);
      await blocker.settled;
      await undoing;
      starting.resolve([]);
      await starting.promise;
    }

    const [undone] = await undoing;
    const [started] = await starting.promise;
    expect(undone).toMatchObject({ status: "fulfilled", value: { status: "updated" } });
    const startError = started?.status === "rejected" ? started.reason : undefined;
    expect.soft(startError).toBeUndefined();
    const startStatus = started?.status === "fulfilled" ? started.value.status : undefined;
    expect.soft(["notFound", "blockFinished"]).toContain(startStatus);
    const restored = await readDay(day.id);
    expect.soft(restored).toMatchObject({ startedAt: null, status: "planned" });

    expect(restored.blocks.map((block) => block.id)).toStrictEqual(
      day.blocks.map((block) => block.id),
    );

    const sessionStarts = await prisma.learningEvent.count({
      where: {
        contentIds: { equals: day.id, path: ["studySessionId"] },
        kind: "session",
        userId: goal.userId,
      },
    });

    expect.soft(sessionStarts).toBe(0);
  });

  it("restores a completed day after Apply reopened it with untouched extra blocks", async () => {
    const { day, goal } = await setup();
    /** This fixture writes only its own completion rows; playing lessons would add unrelated assessment setup. */
    await prisma.$transaction([
      prisma.studySessionBlock.updateMany({
        data: { completedAt: NOW, startedAt: NOW, status: "completed" },
        where: { sessionId: day.id },
      }),
      prisma.studySession.update({
        data: { endedAt: NOW, startedAt: NOW, status: "completed" },
        where: { id: day.id },
      }),
      prisma.planItem.updateMany({
        data: { completedAt: NOW, status: "done" },
        where: {
          lessonId: { in: day.blocks.flatMap((block) => block.lessonId ?? []) },
          plan: { goalId: goal.id },
        },
      }),
    ]);

    const completed = await readDay(day.id);
    const change = await applyMoreTime(goal.id);
    const reopened = await readDay(day.id);
    expect(reopened.status).toBe("active");
    expect(reopened.blocks.some((block) => block.status === "pending")).toBe(true);
    /** endedAt remains historical when Apply adds study time; status and open blocks describe the day now. */
    expect(reopened.endedAt).toStrictEqual(completed.endedAt);

    await expect(undo({ changeId: change.id, goalId: goal.id })).resolves.toMatchObject({
      status: "updated",
    });

    const restored = await readDay(day.id);
    expect(restored.status).toBe("completed");
    expect(restored.blocks).toStrictEqual(completed.blocks);

    expect(
      restored.blocks.filter((block) => block.status === "pending" || block.status === "active"),
    ).toHaveLength(0);
  });

  it("keeps unchanged original blocks and their session active after undoing a future light week", async () => {
    const { day, goal } = await setup({ waiting: true });

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "addLightWeek", startDate: "2026-10-19" }], timeZone: "UTC" },
    });

    if (applied.status !== "applied" || !applied.change) {
      throw new Error("Expected an undoable future light week");
    }

    const unchanged = await readDay(day.id);

    expect(unchanged.blocks.map((block) => block.id)).toStrictEqual(
      day.blocks.map((block) => block.id),
    );

    const first = unchanged.blocks[0];

    if (!first) {
      throw new Error("Expected an unchanged original block");
    }

    await expect(
      startStudyBlock({ blockId: first.id, input: { timeZone: "UTC" }, sessionId: day.id }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(undo({ changeId: applied.change.id, goalId: goal.id })).resolves.toMatchObject({
      status: "updated",
    });

    const restored = await readDay(day.id);

    expect(restored.blocks.find((block) => block.id === first.id)).toMatchObject({
      startedAt: NOW,
      status: "active",
    });

    expect(restored).toMatchObject({ startedAt: NOW, status: "active" });
  });

  it("rolls back the plan and keeps Undo retryable when restoring the day violates a real constraint", async () => {
    const { day, goal, plan } = await setup();
    const change = await applyMoreTime(goal.id);

    const [shownPlan, shownDay, stored] = await Promise.all([
      readPlan(plan.id),
      readDay(day.id),
      prisma.planChangeSnapshot.findUniqueOrThrow({ where: { changeId: change.id } }),
    ]);

    const snapshot = parsePlanSnapshot(stored.plan);

    if (!isJsonObject(stored.plan) || !snapshot?.todaySession) {
      throw new Error("Expected a stored day snapshot");
    }

    const currentIds = new Set(shownDay.blocks.map((block) => block.id));
    const returning = snapshot.todaySession.blocks.filter((block) => !currentIds.has(block.id));
    const [first, second] = returning;

    if (!first || !second) {
      throw new Error("Expected two blocks to be recreated on Undo");
    }
    /** Deliberately duplicate two restored positions to trigger the actual session-position constraint. */
    await prisma.planChangeSnapshot.update({
      data: {
        plan: {
          ...stored.plan,
          todaySession: {
            ...snapshot.todaySession,
            blocks: snapshot.todaySession.blocks.map((block) =>
              block.id === second.id ? { ...block, position: first.position } : block,
            ),
          },
        },
      },
      where: { changeId: change.id },
    });

    await expect(undo({ changeId: change.id, goalId: goal.id })).rejects.toMatchObject({
      code: "P2002",
    });

    const failedChange = await prisma.planChange.findUniqueOrThrow({ where: { id: change.id } });
    expect(failedChange.status).toBe("applied");

    await expect(
      prisma.planChangeSnapshot.findUnique({ where: { changeId: change.id } }),
    ).resolves.not.toBeNull();

    await expect(readPlan(plan.id)).resolves.toStrictEqual(shownPlan);
    await expect(readDay(day.id)).resolves.toStrictEqual(shownDay);

    await prisma.planChangeSnapshot.update({
      data: { plan: stored.plan },
      where: { changeId: change.id },
    });

    await expect(undo({ changeId: change.id, goalId: goal.id })).resolves.toMatchObject({
      change: { status: "undone" },
      status: "updated",
    });

    const restored = await readDay(day.id);

    expect(restored.blocks.map((block) => block.id)).toStrictEqual(
      day.blocks.map((block) => block.id),
    );
  });

  it("settles the day when intervening completion leaves no work after Undo", async () => {
    const { day, goal } = await setup();
    const first = day.blocks.find((block) => block.kind === "learn");

    if (!first) {
      throw new Error("Expected a lesson in the original day");
    }

    // Keep this test-owned day to one lesson: finishing its replacement will hold all its work.
    await prisma.studySessionBlock.deleteMany({
      where: { id: { not: first.id }, sessionId: day.id },
    });

    await prisma.studySession.update({
      data: { plannedMinutes: first.estimatedMinutes ?? 3 },
      where: { id: day.id },
    });

    const change = await applyMoreTime(goal.id);
    const changed = await readDay(day.id);
    const replacement = changed.blocks.find((block) => block.lessonId === first.lessonId);

    if (!replacement || replacement.id === first.id) {
      throw new Error("Expected the changed day to replace the original lesson block");
    }

    await expect(
      startStudyBlock({ blockId: replacement.id, input: { timeZone: "UTC" }, sessionId: day.id }),
    ).resolves.toMatchObject({ status: "ready" });

    await prisma.studySessionBlock.update({
      data: { completedAt: NOW, status: "completed" },
      where: { id: replacement.id },
    });

    await expect(undo({ changeId: change.id, goalId: goal.id })).resolves.toMatchObject({
      status: "updated",
    });

    const restored = await readDay(day.id);
    expect(restored.blocks).toHaveLength(1);
    expect(restored.blocks[0]).toMatchObject({ id: replacement.id, status: "completed" });
    expect(restored).toMatchObject({ endedAt: NOW, status: "completed" });
    expect(restored.endSnapshot).not.toBeNull();

    const ledger = await prisma.learningEvent.findFirstOrThrow({
      where: {
        contentIds: { equals: day.id, path: ["studySessionId"] },
        kind: "session",
        userId: goal.userId,
      },
    });

    expect(ledger.endedAt).toStrictEqual(NOW);
  });

  it("keeps an original block's intervening start when Undo removes its skip", async () => {
    const { day, goal } = await setup({ waiting: true });

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "addLightWeek", startDate: "2026-10-19" }], timeZone: "UTC" },
    });

    if (applied.status !== "applied" || !applied.change) {
      throw new Error("Expected an undoable light week");
    }

    const first = day.blocks[0];

    if (!first) {
      throw new Error("Expected an original block");
    }

    await expect(
      startStudyBlock({ blockId: first.id, input: { timeZone: "UTC" }, sessionId: day.id }),
    ).resolves.toMatchObject({ status: "ready" });

    await prisma.studySessionBlock.update({ data: { status: "skipped" }, where: { id: first.id } });

    await expect(undo({ changeId: applied.change.id, goalId: goal.id })).resolves.toMatchObject({
      status: "updated",
    });

    const restored = await readDay(day.id);

    expect(restored.blocks.find((block) => block.id === first.id)).toMatchObject({
      startedAt: NOW,
      status: "active",
    });

    expect(restored).toMatchObject({ startedAt: NOW, status: "active" });
  });
});
