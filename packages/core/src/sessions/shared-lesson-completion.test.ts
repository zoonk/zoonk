import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { setupPlayableLesson } from "../lesson-player/_test-utils/playable-lesson-setup";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { skipTestedOutBlocks } from "./_utils/skip-tested-out-blocks";
import { toBlockPayload } from "./block-payload";
import { startStudyBlock } from "./start-study-block";

const NOW = new Date("2020-09-28T12:00:00Z");

async function setup() {
  freezeClock();
  vi.setSystemTime(NOW);
  const { lesson, user } = await setupPlayableLesson({ steps: ["explanation", "summary"] });
  const stranger = await userFixture();

  const goals = await Promise.all([
    goalFixture({ timezone: "UTC", userId: user.id }),
    goalFixture({ timezone: "UTC", userId: user.id }),
    goalFixture({ status: "paused", timezone: "UTC", userId: user.id }),
    goalFixture({ timezone: "UTC", userId: stranger.id }),
  ]);

  const plans = await Promise.all(
    goals.map((goal) => planFixture({ goalId: goal.id, items: [{ lessonId: lesson.id }] })),
  );

  const sessions = await Promise.all(
    goals.map((goal) =>
      studySessionFixture({
        goalId: goal.id,
        startedAt: NOW,
        status: "active",
        userId: goal.userId,
      }),
    ),
  );

  const [source, other, paused, foreign] = sessions;

  if (!source || !other || !paused || !foreign) {
    throw new Error("Missing sessions");
  }

  const future = await studySessionFixture({
    goalId: other.goalId,
    localDate: new Date("2020-09-29"),
    userId: user.id,
  });

  const ended = await studySessionFixture({
    goalId: other.goalId,
    localDate: new Date("2020-09-27"),
    status: "completed",
    userId: user.id,
  });

  const [
    current,
    pending,
    futurePending,
    pausedPending,
    active,
    reinforcement,
    replay,
    history,
    foreignBlock,
  ] = await Promise.all([
    studySessionBlockFixture({
      lessonId: lesson.id,
      sessionId: source.id,
      startedAt: NOW,
      status: "active",
    }),
    studySessionBlockFixture({ lessonId: lesson.id, position: 0, sessionId: other.id }),
    studySessionBlockFixture({ lessonId: lesson.id, sessionId: future.id }),
    studySessionBlockFixture({ lessonId: lesson.id, sessionId: paused.id }),
    studySessionBlockFixture({
      lessonId: lesson.id,
      position: 1,
      sessionId: other.id,
      startedAt: NOW,
      status: "active",
    }),
    studySessionBlockFixture({
      lessonId: lesson.id,
      payload: toBlockPayload({ reinforcement: true }),
      position: 2,
      sessionId: other.id,
    }),
    studySessionBlockFixture({
      lessonId: lesson.id,
      payload: toBlockPayload({ extra: true }),
      position: 3,
      sessionId: other.id,
    }),
    studySessionBlockFixture({ lessonId: lesson.id, sessionId: ended.id }),
    studySessionBlockFixture({ lessonId: lesson.id, sessionId: foreign.id }),
  ]);

  return {
    active,
    current,
    foreignBlock,
    futurePending,
    history,
    lesson,
    other,
    pausedPending,
    pending,
    plans,
    reinforcement,
    replay,
    source,
    user,
  };
}

async function expectCarryover(fixture: Awaited<ReturnType<typeof setup>>) {
  for (const block of [fixture.pending, fixture.futurePending, fixture.pausedPending]) {
    // oxlint-disable-next-line no-await-in-loop -- assert each saved queue's outcome
    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ brainPower: 0, completedAt: null, status: "skipped" });
  }

  for (const block of [
    fixture.active,
    fixture.reinforcement,
    fixture.replay,
    fixture.history,
    fixture.foreignBlock,
  ]) {
    // oxlint-disable-next-line no-await-in-loop -- each exclusion has its own persisted status
    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toStrictEqual(block);
  }

  await expect(
    startStudyBlock({ blockId: fixture.pending.id, input: {}, sessionId: fixture.other.id }),
  ).resolves.toStrictEqual({ status: "blockFinished" });
}

describe("shared lessons in saved days", () => {
  it("skips other goals' pending teaching on completion, preserving active work and replays", async () => {
    const fixture = await setup();

    const started = await startLibraryLesson({
      input: { studySessionId: fixture.source.id, timeZone: "UTC" },
      lessonId: fixture.lesson.id,
    });

    if (started.status !== "started") {
      throw new Error(started.status);
    }

    const complete = () =>
      completeLibraryLesson({
        input: { runId: started.run.runId, timeZone: "UTC" },
        lessonId: fixture.lesson.id,
      });

    const outcomes = await Promise.all([complete(), complete()]);
    expect(outcomes).toMatchObject([{ status: "completed" }, { status: "completed" }]);
    await expectCarryover(fixture);

    const owed = await prisma.followUp.count({
      where: { kind: "settleSessionDay", userId: fixture.user.id },
    });

    await complete();

    await expect(
      prisma.followUp.count({ where: { kind: "settleSessionDay", userId: fixture.user.id } }),
    ).resolves.toBe(owed);

    await expect(
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: fixture.user.id } }),
    ).resolves.toMatchObject({ lessonsCompleted: 1 });
  });

  it("shares a test-out with pending teaching in other goals while retaining the source goal's active skip", async () => {
    const fixture = await setup();
    const planItemIds = fixture.plans[0]?.items.map((item) => item.id) ?? [];

    await prisma.planItem.updateMany({
      data: { completedAt: NOW, status: "testedOut" },
      where: { lessonId: fixture.lesson.id, plan: { goal: { userId: fixture.user.id } } },
    });

    await skipTestedOutBlocks({
      goalId: fixture.source.goalId ?? "",
      notStarted: true,
      planItemIds,
    });

    await expectCarryover(fixture);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: fixture.current.id } }),
    ).resolves.toMatchObject({ status: "skipped" });

    await expect(prisma.dailyProgress.count({ where: { userId: fixture.user.id } })).resolves.toBe(
      0,
    );
  });
});
