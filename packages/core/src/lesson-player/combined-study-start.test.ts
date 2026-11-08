import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { toUTCMidnight } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { sessionGoalFixture } from "../sessions/_test-utils/session-goal";
import { toDayBlockRef } from "../sessions/day-block";
import { openStudyBlock } from "../sessions/open-block";
import { getTodayView } from "../view-models/today/get-today-view";
import { setupPlayableLesson } from "./_test-utils/playable-lesson-setup";
import { startLibraryLesson } from "./start-library-lesson";

async function setup() {
  freezeClock();
  const played = await setupPlayableLesson();

  const session = await studySessionFixture({
    localDate: toUTCMidnight(new Date()),
    userId: played.user.id,
  });

  const block = await studySessionBlockFixture({
    kind: "learn",
    lessonId: played.lesson.id,
    sessionId: session.id,
  });

  const opening = { target: { blockId: block.id, kind: "block" as const }, timeZone: "UTC" };
  return { ...played, block, opening, session };
}

async function claims(userId: string) {
  return {
    runs: await prisma.learningEvent.count({ where: { kind: "lesson", userId } }),
    usage: await prisma.usageRecord.count({ where: { kind: "lessonStart", userId } }),
  };
}

describe("a lesson's combined study opening", () => {
  it("admits the exact duplicate lesson block and returns its canonical session", async () => {
    const { block, lesson, opening, session, user } = await setup();

    const duplicate = await studySessionBlockFixture({
      kind: "learn",
      lessonId: lesson.id,
      position: 1,
      sessionId: session.id,
    });

    const started = await startLibraryLesson({
      input: { opening, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    expect(started).toMatchObject({ run: { sessionId: session.id }, status: "started" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "active" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: duplicate.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    await expect(claims(user.id)).resolves.toStrictEqual({ runs: 1, usage: 1 });
  });

  it.each(["finished", "gone", "foreign", "yesterday"] as const)(
    "returns an opening for %s work without a run or claim",
    async (state) => {
      const { block, lesson, opening, session, user } = await setup();

      if (state === "finished") {
        await prisma.studySessionBlock.update({
          data: { status: "completed" },
          where: { id: block.id },
        });
      }

      if (state === "gone") {
        opening.target.blockId = randomUUID();
      }

      if (state === "foreign") {
        const other = await userFixture();
        await prisma.studySession.update({ data: { userId: other.id }, where: { id: session.id } });
      }

      if (state === "yesterday") {
        await prisma.studySession.update({
          data: { localDate: new Date("2020-01-01") },
          where: { id: session.id },
        });
      }

      await expect(
        startLibraryLesson({ input: { opening, timeZone: "UTC" }, lessonId: lesson.id }),
      ).resolves.toMatchObject({ status: "opened" });

      await expect(claims(user.id)).resolves.toStrictEqual({ runs: 0, usage: 0 });
    },
  );

  it("retries after block admission and handles concurrent starts with one run and claim", async () => {
    const { lesson, opening, session, user } = await setup();
    await openStudyBlock(opening);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        startLibraryLesson({ input: { opening, timeZone: "UTC" }, lessonId: lesson.id }),
      ),
    );

    expect(outcomes.every((result) => result.status === "started")).toBe(true);
    await expect(claims(user.id)).resolves.toStrictEqual({ runs: 1, usage: 1 });

    await expect(
      prisma.followUp.count({
        where: { key: session.id, kind: "prepareSession", userId: user.id },
      }),
    ).resolves.toBe(1);
  });

  it("continues an admitted run without repeating a now-invalid opening", async () => {
    const { lesson, opening, session, user } = await setup();

    const started = await startLibraryLesson({
      input: { opening, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    if (started.status !== "started") {
      throw new Error("Expected an admitted lesson");
    }

    await prisma.studySession.update({
      data: { localDate: new Date("2020-01-01") },
      where: { id: session.id },
    });

    const resumed = await startLibraryLesson({
      input: {
        opening: { target: { blockId: randomUUID(), kind: "block" } },
        runId: started.run.runId,
        timeZone: "UTC",
      },
      lessonId: lesson.id,
    });

    expect(resumed).toMatchObject({
      run: { runId: started.run.runId, sessionId: session.id },
      status: "started",
    });

    await expect(claims(user.id)).resolves.toStrictEqual({ runs: 1, usage: 1 });
  });

  it("adopts an existing standalone sitting into the explicitly admitted session", async () => {
    const { lesson, opening, session, user } = await setup();
    const first = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });

    const joined = await startLibraryLesson({
      input: { opening, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    expect(joined).toMatchObject({ run: { sessionId: session.id }, status: "started" });

    expect(
      first.status === "started" &&
        joined.status === "started" &&
        first.run.runId === joined.run.runId,
    ).toBe(true);

    await expect(claims(user.id)).resolves.toStrictEqual({ runs: 1, usage: 1 });
  });

  it("admits the carried day after midnight and continues its run after carry-over ends", async () => {
    const { lesson, opening, session, user } = await setup();
    vi.setSystemTime(new Date("2026-10-01T00:05:00Z"));

    await prisma.studySession.update({
      data: {
        localDate: new Date("2026-09-30"),
        startedAt: new Date("2026-09-30T23:50:00Z"),
        status: "active",
      },
      where: { id: session.id },
    });

    const started = await startLibraryLesson({
      input: { opening, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    if (started.status !== "started") {
      throw new Error("Expected the carried day to admit its lesson");
    }

    expect(started.run.sessionId).toBe(session.id);
    vi.setSystemTime(new Date("2026-10-01T08:00:00Z"));

    await expect(
      startLibraryLesson({
        input: { opening, runId: started.run.runId, timeZone: "UTC" },
        lessonId: lesson.id,
      }),
    ).resolves.toMatchObject({ run: { runId: started.run.runId }, status: "started" });

    await expect(
      startLibraryLesson({ input: { opening, timeZone: "UTC" }, lessonId: lesson.id }),
    ).resolves.toStrictEqual({ opening: { kind: "today" }, status: "opened" });

    await expect(claims(user.id)).resolves.toStrictEqual({ runs: 1, usage: 1 });
  });

  it("uses the explicit opening's time zone when its containing request has none", async () => {
    const { lesson, opening, session } = await setup();
    vi.setSystemTime(new Date("2026-10-01T00:05:00Z"));

    await prisma.studySession.update({
      data: { localDate: new Date("2026-09-30") },
      where: { id: session.id },
    });

    await expect(
      startLibraryLesson({
        input: { opening: { ...opening, timeZone: "America/Los_Angeles" } },
        lessonId: lesson.id,
      }),
    ).resolves.toMatchObject({ run: { sessionId: session.id }, status: "started" });
  });

  it("opens the exact unopened reference and rejects a changed flag without allowance", async () => {
    freezeClock();

    const { lesson, user } = await setupPlayableLesson();

    const { goal, planItems, skills } = await sessionGoalFixture({
      itemsPerSkill: 0,
      lessons: 1,
      userId: user.id,
    });

    const item = planItems[0];
    const skill = skills[0];

    if (!item || !skill) {
      throw new Error("Expected planned teaching");
    }

    await Promise.all([
      prisma.planItem.update({ data: { lessonId: lesson.id }, where: { id: item.id } }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]);

    const shown = await getTodayView({ goalId: goal.id });

    if (shown.status !== "ready") {
      throw new Error("Expected the unopened day");
    }

    const block = shown.today.session.blocks.find((candidate) => candidate.lessonId === lesson.id);

    if (!block) {
      throw new Error("Expected the shown lesson");
    }

    const ref = toDayBlockRef(block);

    const opening = {
      goalId: goal.id,
      shownDate: shown.today.session.localDate.toISOString().slice(0, 10),
      target: { kind: "ref" as const, ref: { ...ref, flags: { ...ref.flags, extra: true } } },
    };

    await expect(
      startLibraryLesson({ input: { opening, timeZone: "UTC" }, lessonId: lesson.id }),
    ).resolves.toMatchObject({ status: "opened" });

    await expect(claims(user.id)).resolves.toStrictEqual({ runs: 0, usage: 0 });

    const started = await startLibraryLesson({
      input: { opening: { ...opening, target: { kind: "ref", ref } }, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    expect(started).toMatchObject({ status: "started" });
    expect(started.status === "started" && started.run.sessionId).toBeTruthy();
    await expect(claims(user.id)).resolves.toStrictEqual({ runs: 1, usage: 1 });
  });

  it("keeps the allowance refusal after study admission without starting a run", async () => {
    const { lesson, opening, user } = await setup();
    await usageRecordsFixture({ count: 20, kind: "lessonStart", userId: user.id });

    const outcome = await startLibraryLesson({
      input: { opening, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    expect(outcome.status).toBe("limitReached");

    await expect(
      prisma.learningEvent.count({ where: { kind: "lesson", userId: user.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.usageRecord.count({
        where: { kind: "lessonStart", targetId: lesson.id, userId: user.id },
      }),
    ).resolves.toBe(0);
  });
});
