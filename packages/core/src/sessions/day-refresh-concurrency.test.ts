import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayStudySession } from "./_test-utils/open-today";
import { followPlanChangeToday, refreshDayFromPlan } from "./_utils/refresh-day-session";
import { STUDY_SESSION_INCLUDE } from "./_utils/study-session-access";

const NOW = new Date("2026-09-30T12:00:00Z");

/** All blocks are done, but completion of the parent is still about to commit. */
async function setupCompletionWindow() {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 12 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2026-09-30" },
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);
  const opened = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

  if (opened.status !== "ready") {
    throw new Error("Expected a built study day");
  }

  const day = opened.session;
  const lessonIds = day.blocks.flatMap((block) => block.lessonId ?? []);
  /** Own fixture rows isolate refresh semantics without playing unrelated lesson assessments. */
  await prisma.$transaction([
    prisma.studySessionBlock.updateMany({
      data: { completedAt: NOW, startedAt: NOW, status: "completed" },
      where: { sessionId: day.id },
    }),
    prisma.studySession.update({
      data: { startedAt: NOW, status: "active" },
      where: { id: day.id },
    }),
    prisma.planItem.updateMany({
      data: { completedAt: NOW, status: "done" },
      where: { lessonId: { in: lessonIds }, planId: plan.id },
    }),
    prisma.goal.update({ data: { dailyMinutes: 30 }, where: { id: goal.id } }),
    prisma.plan.update({ data: { version: { increment: 1 } }, where: { id: plan.id } }),
    prisma.planItem.updateMany({
      data: { scheduledFor: day.localDate },
      where: { kind: "lesson", planId: plan.id, status: "todo" },
    }),
  ]);

  const session = await prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: day.id },
  });

  expect(session.status).toBe("active");
  expect(session.blocks.length).toBeGreaterThan(0);
  expect(session.blocks.every((block) => block.status === "completed")).toBe(true);
  return { goal, session, user };
}

/** Commit completion only after the refresh has read the active parent and waits for its lock. */
async function completeDuringRefresh<T>({
  refresh,
  sessionId,
}: {
  refresh: () => Promise<T>;
  sessionId: string;
}) {
  const ready = Promise.withResolvers<number>();
  const complete = Promise.withResolvers<null>();

  const held = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM study_sessions WHERE id = ${sessionId}::uuid FOR NO KEY UPDATE
      `;

      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      ready.resolve(connection?.pid ?? 0);
      await complete.promise;

      await tx.studySession.update({
        data: { endedAt: NOW, status: "completed" },
        where: { id: sessionId },
      });
    },
    { timeout: 12_000 },
  );

  const completing = Promise.allSettled([held]);
  void held.catch(ready.reject);
  const holderPid = await ready.promise;
  const refreshing = Promise.allSettled([refresh()]);

  try {
    await expect
      .poll(
        async () => prisma.$queryRaw<{ pid: number }[]>`
        SELECT pid FROM pg_stat_activity
        WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))
          AND query ~* 'study_sessions.*FOR NO KEY UPDATE'
      `,
        { interval: 10, timeout: 4000 },
      )
      .not.toHaveLength(0);
  } finally {
    complete.resolve(null);
    await completing;
    await refreshing;
  }

  const [completion] = await completing;
  const [result] = await refreshing;
  expect(completion?.status).toBe("fulfilled");

  if (result?.status !== "fulfilled") {
    throw new Error("Expected refresh to finish", {
      cause: result?.status === "rejected" ? result.reason : undefined,
    });
  }

  return result.value;
}

describe("day refresh races a completed parent with unchanged finished blocks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reopens the freshly completed day when the learner's change adds work", async () => {
    const { goal, session, user } = await setupCompletionWindow();

    const result = await completeDuringRefresh({
      refresh: () =>
        followPlanChangeToday({
          goalId: goal.id,
          localDate: session.localDate,
          timeZone: "UTC",
          userId: user.id,
        }),
      sessionId: session.id,
    });

    expect(result).toBe("rebuilt");

    const refreshed = await prisma.studySession.findUniqueOrThrow({
      include: STUDY_SESSION_INCLUDE,
      where: { id: session.id },
    });

    expect(refreshed.blocks.some((block) => block.status === "pending")).toBe(true);

    expect(refreshed.blocks.filter((block) => block.status === "completed")).toStrictEqual(
      session.blocks,
    );
    /** A historical ending remains when explicit added time opens the day again. */
    expect(refreshed.endedAt).toStrictEqual(NOW);
    expect(refreshed.status).toBe("active");
  });

  it("leaves the freshly completed day unchanged when a plan read appends newly available lessons", async () => {
    const { session } = await setupCompletionWindow();

    const refreshed = await completeDuringRefresh({
      refresh: () => refreshDayFromPlan({ session, timeZone: "UTC" }),
      sessionId: session.id,
    });

    expect(refreshed).toMatchObject({ endedAt: NOW, status: "completed" });
    expect.soft(refreshed.blocks).toStrictEqual(session.blocks);
    expect.soft(refreshed.plannedMinutes).toBe(session.plannedMinutes);
    expect.soft(refreshed.planVersion).toBe(session.planVersion);
  });
});
