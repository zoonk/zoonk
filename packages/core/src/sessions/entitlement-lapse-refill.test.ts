import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { getLearnerSummary } from "../learner/summary/get-learner-summary";
import { getTodayView } from "../view-models/today/get-today-view";
import { lapsedDayFixture, readLapsedDayState } from "./_test-utils/entitlement-lapse";
import { SESSION_NOW } from "./_test-utils/session-goal";
import { toDayBlockRef } from "./day-block";
import { openStudyDay } from "./open-study-day";

describe("entitlement lapse keeps a free way forward", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("previews the exact free refill without writes before Open persists it", async () => {
    const day = await lapsedDayFixture();
    const before = await readLapsedDayState(day.user.id);

    const reads = await countDatabaseStatements(async () => ({
      summary: await getLearnerSummary(),
      today: await getTodayView({ goalId: day.goal.id, timeZone: "UTC" }),
    }));

    expect(reads.writes).toBe(0);
    await expect(readLapsedDayState(day.user.id)).resolves.toStrictEqual(before);
    const { today, summary } = reads.result;
    expect(today.status).toBe("ready");

    if (today.status !== "ready") {
      throw new Error("Expected Today");
    }

    const preview = today.today.session;
    expect(preview.blocks).toHaveLength(1);

    expect(preview.blocks[0]).toMatchObject({
      kind: "learn",
      lessonId: day.planItems.at(-1)?.lessonId,
    });

    expect(preview.blocks[0]).not.toHaveProperty("id");

    // The summary previews the same free step as Today before Open saves it, and names it after.
    expect(summary?.today).toMatchObject({
      blocksLeft: 1,
      next: {
        minutes: preview.blocks[0]?.estimatedMinutes,
        sessionId: day.sessionId,
        title: preview.blocks[0]?.title,
      },
    });

    const refs = preview.blocks.map(toDayBlockRef);

    const opened = await openStudyDay({
      goalId: day.goal.id,
      shownDate: "2026-09-30",
      target: { kind: "next", shown: refs[0]! },
      timeZone: "UTC",
    });

    expect(opened.status).toBe("opened");

    if (opened.status !== "opened") {
      throw new Error("Expected Open");
    }

    expect(opened.sessionId).toBe(day.sessionId);
    expect(opened.session.blocks.map(toDayBlockRef)).toStrictEqual(refs);

    expect(opened.session.blocks.map(({ id: _id, ...fields }) => fields)).toStrictEqual(
      preview.blocks,
    );

    expect(opened.session.minutes).toStrictEqual(preview.minutes);
    expect(preview.extraTime).toStrictEqual(opened.session.extraTime);
    expect(preview.catchUp).toStrictEqual(opened.session.catchUp);
    expect(opened.targetStatus).toBe("next");

    await expect(getLearnerSummary()).resolves.toMatchObject({
      today: {
        blocksLeft: 1,
        next: {
          minutes: preview.blocks[0]?.estimatedMinutes,
          sessionId: day.sessionId,
          title: preview.blocks[0]?.title,
        },
      },
    });

    const after = await readLapsedDayState(day.user.id);

    const replay = await countDatabaseStatements(() =>
      getTodayView({ goalId: day.goal.id, timeZone: "UTC" }),
    );

    expect(replay.writes).toBe(0);
    await expect(readLapsedDayState(day.user.id)).resolves.toStrictEqual(after);
  });

  it("two concurrent Opens append once with conservative freshness and a replay leaves state unchanged", async () => {
    const day = await lapsedDayFixture();
    const before = await readLapsedDayState(day.user.id);
    const input = { goalId: day.goal.id, shownDate: "2026-09-30", timeZone: "UTC" };
    const opened = await Promise.all([openStudyDay(input), openStudyDay(input)]);
    expect(opened.every((result) => result.status === "opened")).toBe(true);
    const after = await readLapsedDayState(day.user.id);
    expect(after.sessions[0]?.blocks.filter((block) => block.kind === "learn")).toHaveLength(1);
    expect(after.plans[0]?.inputVersion).toBeGreaterThanOrEqual(before.plans[0]!.inputVersion + 1);
    expect(after.plans[0]?.inputVersion).toBeLessThanOrEqual(before.plans[0]!.inputVersion + 2);
    await openStudyDay(input);
    await expect(readLapsedDayState(day.user.id)).resolves.toStrictEqual(after);
  });

  it.each([false, true])(
    "retains the full stored budget on renewal (completed work: %s)",
    async (completed) => {
      const day = await lapsedDayFixture();

      const kept = completed
        ? await prisma.studySessionBlock.create({
            data: {
              brainPower: 5,
              completedAt: SESSION_NOW,
              estimatedMinutes: 2,
              kind: "learn",
              lessonId: day.planItems[0]!.lessonId,
              payload: {},
              position: 1,
              sessionId: day.sessionId,
              status: "completed",
            },
          })
        : null;

      if (kept) {
        await prisma.studySession.update({
          data: { plannedMinutes: { increment: 2 } },
          where: { id: day.sessionId },
        });
      }

      const input = { goalId: day.goal.id, shownDate: "2026-09-30", timeZone: "UTC" };
      const free = await openStudyDay(input);
      expect(free.status).toBe("opened");

      await prisma.subscription.updateMany({
        data: { status: "active" },
        where: { referenceId: day.user.id },
      });

      const restored = await getTodayView(input);
      expect(restored.status).toBe("ready");

      if (restored.status !== "ready") {
        throw new Error("Expected renewed Today");
      }

      const session = restored.today.session;

      expect(
        session.blocks.filter((block) => block.status !== "completed").map((block) => block.kind),
      ).toStrictEqual(["checkpoint", "learn"]);

      expect(session.minutes.done).toBe(completed ? 2 : 0);

      const preserved = kept
        ? await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: kept.id } })
        : null;

      expect(preserved).toStrictEqual(kept);

      const stored = await prisma.studySession.findUniqueOrThrow({
        include: { blocks: true },
        where: { id: day.sessionId },
      });

      expect(stored.plannedMinutes).toBe(
        stored.blocks.reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0),
      );

      expect(session.minutes.planned).toBe(stored.plannedMinutes);
    },
  );

  it("keeps a failed chapter test unavailable in both the refill preview and saved day", async () => {
    const day = await lapsedDayFixture();
    const chapter = await libraryChapterFixture();
    const later = day.planItems.at(-1)!;
    await prisma.planItem.update({ data: { chapterId: chapter.id }, where: { id: later.id } });

    await learningEventFixture({
      contentIds: { chapterId: chapter.id, testOutPassed: "false" },
      endedAt: new Date("2026-09-30T11:00:00Z"),
      goalId: day.goal.id,
      kind: "checkpoint",
      lessonKind: "testOut",
      userId: day.user.id,
    });

    const read = await getTodayView({ goalId: day.goal.id, timeZone: "UTC" });
    expect(read.status).toBe("ready");

    if (read.status !== "ready") {
      throw new Error("Expected Today");
    }

    expect(read.today.session.blocks[0]).toMatchObject({
      canTestOut: false,
      chapterId: chapter.id,
    });

    const opened = await openStudyDay({
      goalId: day.goal.id,
      shownDate: "2026-09-30",
      timeZone: "UTC",
    });

    expect(opened.status).toBe("opened");

    if (opened.status !== "opened") {
      throw new Error("Expected Open");
    }

    expect(opened.session.blocks[0]).toMatchObject({ canTestOut: false, chapterId: chapter.id });
  });

  it.each(["pause", "minutes"])(
    "rejects stale refill inputs after a real %s race",
    async (change) => {
      const day = await lapsedDayFixture();
      const before = await readLapsedDayState(day.user.id);
      const ready = Promise.withResolvers<number>();
      const release = Promise.withResolvers<null>();

      const holding = prisma.$transaction(
        async (tx) => {
          await markLearnerChanged(tx, { planInputs: true, userId: day.user.id });

          const [connection] = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;

          ready.resolve(connection!.pid);
          await release.promise;

          await tx.goal.update({
            data: change === "pause" ? { status: "paused" } : { dailyMinutes: 30 },
            where: { id: day.goal.id },
          });
        },
        { timeout: 12_000 },
      );

      const held = Promise.allSettled([holding]);
      void holding.catch(ready.reject);
      const pid = await ready.promise;

      const opening = Promise.allSettled([
        openStudyDay({ goalId: day.goal.id, shownDate: "2026-09-30", timeZone: "UTC" }),
      ]);

      try {
        await expect
          .poll(
            () =>
              prisma.$queryRaw<
                { pid: number }[]
              >`SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid)) AND query ~* 'plans.*FOR UPDATE'`,
            { interval: 10, timeout: 4000 },
          )
          .not.toHaveLength(0);
      } finally {
        release.resolve(null);
        await held;
        await opening;
      }

      await expect(opening).resolves.toMatchObject([
        { status: "fulfilled", value: { status: "retryable" } },
      ]);

      const after = await readLapsedDayState(day.user.id);
      expect(after.sessions).toStrictEqual(before.sessions);
      expect(after.plans[0]?.inputVersion).toBe(before.plans[0]!.inputVersion + 1);
    },
  );

  it("moves a carried refill out of later catch-up before and after persistence", async () => {
    const day = await lapsedDayFixture();
    await prisma.studySession.update({ data: { freshStart: null }, where: { id: day.sessionId } });

    await prisma.planChange.create({
      data: {
        kind: "missedDays",
        payload: { carriedItemIds: [day.planItems.at(-1)!.id], days: 1, source: "system" },
        planId: day.plan.id,
        reason: "Earlier teaching carried into this day",
        status: "applied",
      },
    });

    const result = await getTodayView({ goalId: day.goal.id, timeZone: "UTC" });

    if (result.status !== "ready") {
      throw new Error("Expected Today");
    }

    const preview = result.today.session;

    expect(preview.catchUp).toMatchObject({
      later: { lessons: 0, minutes: 0, offered: false },
      lessonsLeft: 1,
      positions: [preview.blocks[0]!.position],
    });

    const opened = await openStudyDay({
      goalId: day.goal.id,
      shownDate: "2026-09-30",
      timeZone: "UTC",
    });

    if (opened.status !== "opened") {
      throw new Error("Expected Open");
    }

    const saved = opened.session.catchUp;

    expect(
      saved && { later: saved.later, lessonsLeft: saved.lessonsLeft, positions: saved.positions },
    ).toStrictEqual(preview.catchUp);
  });
});
