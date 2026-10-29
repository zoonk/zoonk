import { courseChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { beforeEach, describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChapterTryLesson, getCourseTryLesson } from "./try-lesson";

const guessHook = {
  options: [
    { id: "planet", isCorrect: false, text: "Yes, like a tiny planet" },
    { id: "cloud", isCorrect: true, text: "No, it's more like a cloud" },
  ],
  question: "Does the electron circle the nucleus?",
  reveal: "It's a cloud of chances.",
  variant: "guess",
};

const textHook = { text: "Atoms are mostly empty.", variant: "text" };

const check = {
  basis: null,
  options: [
    { id: "a", isCorrect: true, reason: "Right: the nucleus is tiny.", text: "Empty space" },
    { id: "b", isCorrect: false, reason: "The nucleus is tiny.", text: "The nucleus" },
  ],
  question: "What takes up most of an atom?",
};

function firstStep(lessonId: string, step: { content: object; kind: "check" | "hook" }) {
  return libraryStepFixture({ ...step, lessonId, position: 0 });
}

describe(getCourseTryLesson, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("picks the first lesson that opens with a guess, without its answer", async () => {
    const { course, lessons } = await catalogCourseFixture({ lessonCounts: [2, 1] });
    const [[checked, told] = [], [guessed] = []] = lessons;

    await Promise.all([
      firstStep(checked!.id, { content: check, kind: "check" }),
      firstStep(told!.id, { content: textHook, kind: "hook" }),
      firstStep(guessed!.id, { content: guessHook, kind: "hook" }),
    ]);

    const pick = await getCourseTryLesson({ courseId: course.id });

    expect(pick).toStrictEqual({
      chapterTitle: "Chapter 2",
      lessonId: guessed!.id,
      minutes: guessed!.estimatedMinutes,
      number: 1,
      screen: {
        context: null,
        guess: true,
        kind: "choice",
        options: [
          { id: "planet", text: "Yes, like a tiny planet" },
          { id: "cloud", text: "No, it's more like a cloud" },
        ],
        question: guessHook.question,
      },
    });
  });

  it("falls back to a lesson that opens with a question, and looks only at the first eight", async () => {
    const { course, lessons } = await catalogCourseFixture({ lessonCounts: [9] });
    const [chapterLessons = []] = lessons;

    await Promise.all([
      firstStep(chapterLessons[1]!.id, { content: check, kind: "check" }),
      firstStep(chapterLessons[8]!.id, { content: guessHook, kind: "hook" }),
    ]);

    const pick = await getCourseTryLesson({ courseId: course.id });

    expect(pick).toMatchObject({
      lessonId: chapterLessons[1]!.id,
      number: 2,
      screen: { guess: false, question: check.question },
    });
  });

  it("is null when no lesson opens with a question", async () => {
    const { course, lessons } = await catalogCourseFixture({ lessonCounts: [1] });
    await firstStep(lessons[0]![0]!.id, { content: textHook, kind: "hook" });

    await expect(getCourseTryLesson({ courseId: course.id })).resolves.toBeNull();
  });
});

describe(getChapterTryLesson, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("picks among the chapter's own lessons, in any course that places it", async () => {
    const [{ chapters, lessons }, other] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [1, 2] }),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    const [[elsewhere] = [], [told, guessed] = []] = lessons;
    const chapter = chapters[1]!;

    await Promise.all([
      firstStep(elsewhere!.id, { content: guessHook, kind: "hook" }),
      firstStep(told!.id, { content: textHook, kind: "hook" }),
      firstStep(guessed!.id, { content: guessHook, kind: "hook" }),
      courseChapterFixture({ chapterId: chapter.id, courseId: other.course.id, position: 1 }),
    ]);

    const [inHome, inOther] = await Promise.all([
      getChapterTryLesson({ chapterId: chapter.id }),
      getChapterTryLesson({ chapterId: chapter.id, courseId: other.course.id }),
    ]);

    expect(inHome).toMatchObject({ chapterTitle: chapter.title, lessonId: guessed!.id, number: 2 });
    expect(inOther).toStrictEqual(inHome);
  });
});
