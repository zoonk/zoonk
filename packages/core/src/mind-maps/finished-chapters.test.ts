import { type GoalKind, prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { getChapterMindMap } from "./get-chapter-mind-map";

const TIME_ZONE = "UTC";

async function chapterOfTwoLessons() {
  const [chapter, first, last, skill] = await Promise.all([
    libraryChapterFixture({ title: "Cells" }),
    libraryLessonFixture({ contentStatus: "completed", title: "What a cell is" }),
    playableLessonFixture({ steps: ["explanation", "summary"] }),
    skillFixture(),
  ]);

  await Promise.all([
    chapterLessonFixture({ chapterId: chapter.id, lessonId: first.id, position: 0 }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: last.lesson.id, position: 1 }),
    lessonSkillFixture({ lessonId: last.lesson.id, skillId: skill.id }),
  ]);

  return { chapter, first, last: last.lesson };
}

type Chapter = Awaited<ReturnType<typeof chapterOfTwoLessons>>;

/**
 * A learner who studied the chapter's first lesson and has its last one left. Today is saved, so
 * starting a lesson doesn't plan the goal again from inputs this fixture doesn't have.
 */
async function learnerOf({ chapter, first, last }: Chapter, kind: GoalKind = "learn") {
  const user = await userFixture();
  const goal = await goalFixture({ kind, timezone: TIME_ZONE, userId: user.id });

  const [plan, today] = await Promise.all([
    planFixture({ goalId: goal.id }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
  ]);

  await Promise.all([
    planItemFixture({
      chapterId: chapter.id,
      lessonId: first.id,
      planId: plan.id,
      position: 0,
      status: "done",
    }),
    planItemFixture({ chapterId: chapter.id, lessonId: last.id, planId: plan.id, position: 1 }),
  ]);

  mockSession(user.id);
  return { goal, today, user };
}

async function startRun({ lessonId, sessionId }: { lessonId: string; sessionId?: string }) {
  const started = await startLibraryLesson({
    input: { studySessionId: sessionId, timeZone: TIME_ZONE },
    lessonId,
  });

  if (started.status !== "started") {
    throw new Error(`Expected a started run, got ${started.status}`);
  }

  return started.run.runId;
}

async function finishRun({ lessonId, runId }: { lessonId: string; runId: string }) {
  const outcome = await completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId });

  if (outcome.status !== "completed") {
    throw new Error(`Expected a completion, got ${outcome.status}`);
  }

  return outcome.completion;
}

function owedMaps(userId: string) {
  return prisma.followUp.findMany({
    select: { input: true, key: true },
    where: { kind: "makeChapterMindMap", userId },
  });
}

describe("a finished chapter", () => {
  it("reports the lesson that finished it and owes its map once, without claiming the map", async () => {
    const chapter = await chapterOfTwoLessons();
    const { goal, user } = await learnerOf(chapter);
    const lessonId = chapter.last.id;
    const runId = await startRun({ lessonId });

    const finishedChapter = { chapterId: chapter.chapter.id, goalId: goal.id, title: "Cells" };

    await expect(finishRun({ lessonId, runId })).resolves.toMatchObject({
      finishedChapter,
      studyBlock: null,
    });

    await expect(finishRun({ lessonId, runId })).resolves.toMatchObject({ finishedChapter });

    await expect(owedMaps(user.id)).resolves.toStrictEqual([
      { input: { chapterId: chapter.chapter.id, goalId: goal.id }, key: chapter.chapter.id },
    ]);

    await expect(
      prisma.chapterMindMap.count({ where: { chapterId: chapter.chapter.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.usageRecord.count({ where: { kind: "mindMap", userId: user.id } }),
    ).resolves.toBe(0);

    await expect(getChapterMindMap({ chapterId: chapter.chapter.id })).resolves.toMatchObject({
      mindMap: { lessonsToWrite: 0, status: "drawing" },
    });

    await expect(
      finishRun({ lessonId, runId: await startRun({ lessonId }) }),
    ).resolves.toMatchObject({ finishedChapter: null, isFirstCompletion: false });
  });

  it("reports a chapter the plan files its lessons under by their home, as the list shows it", async () => {
    const chapter = await chapterOfTwoLessons();
    const { goal, user } = await learnerOf(chapter);
    const lessonId = chapter.last.id;

    await Promise.all([
      prisma.lesson.updateMany({
        data: { homeChapterId: chapter.chapter.id },
        where: { id: { in: [chapter.first.id, lessonId] } },
      }),
      prisma.planItem.updateMany({
        data: { chapterId: null },
        where: { plan: { goalId: goal.id } },
      }),
    ]);

    await expect(getChapterMindMap({ chapterId: chapter.chapter.id })).resolves.toMatchObject({
      status: "ready",
    });

    await expect(
      finishRun({ lessonId, runId: await startRun({ lessonId }) }),
    ).resolves.toMatchObject({
      finishedChapter: { chapterId: chapter.chapter.id, goalId: goal.id, title: "Cells" },
    });

    await expect(owedMaps(user.id)).resolves.toStrictEqual([
      { input: { chapterId: chapter.chapter.id, goalId: goal.id }, key: chapter.chapter.id },
    ]);
  });

  it("reports nothing for a lesson that leaves the chapter unfinished", async () => {
    const chapter = await chapterOfTwoLessons();
    const { user } = await learnerOf(chapter);

    await prisma.planItem.updateMany({
      data: { status: "todo" },
      where: { lessonId: chapter.first.id, plan: { goal: { userId: user.id } } },
    });

    const lessonId = chapter.last.id;

    await expect(
      finishRun({ lessonId, runId: await startRun({ lessonId }) }),
    ).resolves.toMatchObject({ finishedChapter: null });

    await expect(owedMaps(user.id)).resolves.toStrictEqual([]);
  });

  it("owes no map once the chapter has one, and none for a language's unit", async () => {
    const chapter = await chapterOfTwoLessons();
    const lessonId = chapter.last.id;

    await prisma.chapterMindMap.create({
      data: { chapterId: chapter.chapter.id, language: "en", status: "completed" },
    });

    const second = await learnerOf(chapter);

    await expect(
      finishRun({ lessonId, runId: await startRun({ lessonId }) }),
    ).resolves.toMatchObject({ finishedChapter: { goalId: second.goal.id } });

    await expect(owedMaps(second.user.id)).resolves.toStrictEqual([]);

    const language = await learnerOf(chapter, "language");

    await expect(
      finishRun({ lessonId, runId: await startRun({ lessonId }) }),
    ).resolves.toMatchObject({ finishedChapter: null });

    await expect(owedMaps(language.user.id)).resolves.toStrictEqual([]);
  });

  it("reports the finish on the session block the lesson completed, too", async () => {
    const chapter = await chapterOfTwoLessons();
    const { goal, today } = await learnerOf(chapter);
    const lessonId = chapter.last.id;

    await studySessionBlockFixture({ lessonId, sessionId: today.id });

    const completion = await finishRun({
      lessonId,
      runId: await startRun({ lessonId, sessionId: today.id }),
    });

    const finishedChapter = { chapterId: chapter.chapter.id, goalId: goal.id, title: "Cells" };

    expect(completion.finishedChapter).toStrictEqual(finishedChapter);
    expect(completion.studyBlock?.finishedChapter).toStrictEqual(finishedChapter);
  });
});
