import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { getStudyBlock } from "../../sessions/get-study-block";
import { getStudySession } from "../../sessions/get-study-session";
import { signedInCourseGoal } from "../../view-models/_test-utils/course-goal";
import { getChapterView } from "../../view-models/chapter/get-chapter-view";
import { submitChapterTestOut } from "./submit-chapter-test-out";

async function setup() {
  freezeClock();
  vi.setSystemTime(new Date("2026-10-13T04:00:00Z"));
  const fixture = await signedInCourseGoal();

  await prisma.goal.update({
    data: { timezone: "America/Sao_Paulo" },
    where: { id: fixture.goal.id },
  });

  const chapterId = fixture.chapters[0]?.id ?? "";

  const session = await studySessionFixture({
    goalId: fixture.goal.id,
    localDate: getDateInTimeZone({ date: new Date(), timeZone: "America/Sao_Paulo" }),
    userId: fixture.user.id,
  });

  const block = await studySessionBlockFixture({
    kind: "learn",
    lessonId: fixture.lessons[0]?.id,
    payload: { chapterId },
    sessionId: session.id,
  });

  return { ...fixture, blockId: block.id, chapterId, session };
}

async function readOffers(fixture: Awaited<ReturnType<typeof setup>>) {
  const [chapter, session, detail] = await Promise.all([
    getChapterView({ chapterId: fixture.chapterId, goalId: fixture.goal.id }),
    getStudySession({ input: { timeZone: "America/Sao_Paulo" }, sessionId: fixture.session.id }),
    getStudyBlock({ blockId: fixture.blockId, sessionId: fixture.session.id }),
  ]);

  return {
    block: session.status === "ready" ? session.session.blocks[0] : null,
    chapter: chapter.status === "ready" ? chapter.chapter.testOut : null,
    detailBlock: detail.status === "ready" ? detail.detail.block : null,
  };
}

describe("test-out offers after a failed test", () => {
  it("recognizes studying a chapter's lesson when the plan schedules its whole chapter", async () => {
    const fixture = await setup();

    await prisma.planItem.update({
      data: { kind: "chapter", lessonId: null },
      where: { id: fixture.items[0]?.id },
    });

    await learningEventFixture({
      contentIds: { chapterId: fixture.chapterId },
      correctAnswers: 1,
      goalId: fixture.goal.id,
      incorrectAnswers: 7,
      kind: "questions",
      lessonKind: "testOut",
      userId: fixture.user.id,
    });

    vi.setSystemTime(new Date("2026-10-13T04:01:00Z"));

    await learningEventFixture({
      contentIds: { lessonId: fixture.lessons[0]?.id },
      userId: fixture.user.id,
    });

    await expect(readOffers(fixture)).resolves.toMatchObject({
      block: { canTestOut: true },
      chapter: { available: true },
    });
  });

  it("allows studying a full lesson again, while a capsule review does not unlock the offer", async () => {
    const fixture = await setup();

    await learningEventFixture({
      contentIds: { chapterId: fixture.chapterId },
      correctAnswers: 1,
      goalId: fixture.goal.id,
      incorrectAnswers: 7,
      kind: "questions",
      lessonKind: "testOut",
      userId: fixture.user.id,
    });

    vi.setSystemTime(new Date("2026-10-13T04:01:00Z"));

    await learningEventFixture({
      contentIds: { lessonId: fixture.lessons[0]?.id },
      kind: "review",
      lessonKind: "capsule",
      userId: fixture.user.id,
    });

    await expect(readOffers(fixture)).resolves.toMatchObject({
      block: { canTestOut: false },
      chapter: { available: false },
    });

    vi.setSystemTime(new Date("2026-10-13T04:02:00Z"));

    await learningEventFixture({
      contentIds: { lessonId: fixture.lessons[0]?.id },
      kind: "review",
      userId: fixture.user.id,
    });

    await expect(readOffers(fixture)).resolves.toMatchObject({
      block: { canTestOut: true },
      chapter: { available: true },
    });
  });

  it("waits for a lesson in that chapter, then offers it again", async () => {
    const fixture = await setup();

    await learningEventFixture({
      contentIds: { chapterId: fixture.chapterId },
      correctAnswers: 1,
      endedAt: new Date(),
      goalId: fixture.goal.id,
      incorrectAnswers: 7,
      kind: "questions",
      lessonKind: "testOut",
      userId: fixture.user.id,
    });

    await expect(readOffers(fixture)).resolves.toMatchObject({
      block: { canTestOut: false },
      chapter: { available: false },
      detailBlock: { canTestOut: false },
    });

    vi.setSystemTime(new Date("2026-10-13T04:01:00Z"));

    await learningEventFixture({
      contentIds: { lessonId: fixture.lessons[2]?.id },
      userId: fixture.user.id,
    });

    await expect(readOffers(fixture)).resolves.toMatchObject({ chapter: { available: false } });

    vi.setSystemTime(new Date("2026-10-13T04:02:00Z"));

    await learningEventFixture({
      contentIds: { lessonId: fixture.lessons[0]?.id },
      userId: fixture.user.id,
    });

    await expect(readOffers(fixture)).resolves.toMatchObject({
      block: { canTestOut: true },
      chapter: { available: true },
    });
  });

  it("uses learner-local midnight", async () => {
    const fixture = await setup();

    await learningEventFixture({
      contentIds: { chapterId: fixture.chapterId },
      correctAnswers: 0,
      endedAt: new Date("2026-10-13T02:30:00Z"),
      goalId: fixture.goal.id,
      incorrectAnswers: 4,
      kind: "questions",
      lessonKind: "testOut",
      userId: fixture.user.id,
    });

    await expect(readOffers(fixture)).resolves.toMatchObject({
      block: { canTestOut: true },
      chapter: { available: true },
    });
  });

  it("records a failed test even when the answers were right but did not cover the chapter", async () => {
    const fixture = await setup();

    const questions = await Promise.all(
      Array.from({ length: 4 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: fixture.skills[0]?.id ?? "" }),
      ),
    );

    await expect(
      submitChapterTestOut({
        chapterId: fixture.chapterId,
        goalId: fixture.goal.id,
        input: {
          answers: questions.map((question) => ({
            answer: { selectedIndex: 0 },
            durationMs: 1000,
            itemId: question.id,
          })),
          requestId: randomUUID(),
        },
      }),
    ).resolves.toMatchObject({ outcome: { correct: 4, passed: false }, status: "ready" });

    await expect(readOffers(fixture)).resolves.toMatchObject({
      block: { canTestOut: false },
      chapter: { available: false },
    });

    vi.setSystemTime(new Date("2026-10-14T03:00:00Z"));

    await expect(readOffers(fixture)).resolves.toMatchObject({
      block: { canTestOut: true },
      chapter: { available: true },
    });
  });

  it("ignores another learner's failed test of the same chapter", async () => {
    const fixture = await setup();
    const other = await userFixture();

    await learningEventFixture({
      contentIds: { chapterId: fixture.chapterId },
      correctAnswers: 0,
      goalId: fixture.goal.id,
      incorrectAnswers: 4,
      kind: "questions",
      lessonKind: "testOut",
      userId: other.id,
    });

    await expect(readOffers(fixture)).resolves.toMatchObject({
      block: { canTestOut: true },
      chapter: { available: true },
    });
  });
});
