import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { chapterLessonFixture, lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { stepOfKind } from "../lesson-player/_test-utils/playable-lesson-setup";
import { checkLessonStep } from "../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { getWeeklyRecap } from "../milestones/get-weekly-recap";
import { getCurrentUserLevel } from "../progress/get-belt-level";
import { getCurrentUserProgress } from "../progress/get-current-user-progress";
import { getCurrentUserEnergy } from "../progress/get-energy-data";
import { getCurrentUserActivity } from "../progress/get-learning-activity";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getCurrentUserScore } from "../progress/get-score-history";
import { getCurrentUserScorePatterns } from "../progress/get-score-patterns";
import { getStudiedToday } from "../progress/get-studied-today";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so lesson starts here are never rate limited. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

/** Every progress resource the learner's pages read. */
function readProgress(timeZone: string) {
  return Promise.all([
    getCurrentUserActivity(),
    getCurrentUserProgress(),
    getCurrentUserScore(),
    getCurrentUserScorePatterns(),
    getCurrentUserEnergy(),
    getCurrentUserLevel(),
    getStudiedToday(),
    getWeeklyRecap({ timeZone }),
  ]);
}

const TIME_ZONE = "UTC";
const RIGHT_TYPED = "It shows where the electron is likely to be";

/** A Library course whose one chapter holds a written lesson with a check and a typed answer. */
async function createCourse() {
  const [course, skill] = await Promise.all([courseFixture(), skillFixture()]);
  const chapter = await libraryChapterFixture({ homeCourseId: course.id });

  const { lesson, steps } = await playableLessonFixture({
    lesson: { homeChapterId: chapter.id },
    steps: ["hook", "explanation", "check", "typedAnswer", "summary"],
  });

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
  ]);

  return { chapter, course, lesson, steps };
}

/** Plays the lesson the way the player does: start, answer both questions, finish. */
async function playLesson({ lesson, steps }: Awaited<ReturnType<typeof createCourse>>) {
  const input = { timeZone: TIME_ZONE };
  const started = await startLibraryLesson({ input, lessonId: lesson.id });

  if (started.status !== "started") {
    throw new Error(`Expected a started run, got ${started.status}`);
  }

  const answer = { ...input, durationMs: 5000, runId: started.run.runId };

  await checkLessonStep({
    input: { ...answer, answer: { kind: "check", optionId: "likely" } },
    stepId: stepOfKind(steps, "check").id,
  });

  await checkLessonStep({
    input: { ...answer, answer: { kind: "typedAnswer", text: RIGHT_TYPED } },
    stepId: stepOfKind(steps, "typedAnswer").id,
  });

  return completeLibraryLesson({ input: { ...answer }, lessonId: lesson.id });
}

describe("progress after content is deleted", () => {
  it("returns the same values from every progress query once the course and its lesson are gone", async () => {
    const [user, library] = await Promise.all([userFixture(), createCourse()]);
    const now = new Date();
    mockSession(user.id);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      currentInstant: now,
      timeZone: TIME_ZONE,
    });

    await expect(playLesson(library)).resolves.toMatchObject({ status: "completed" });

    const before = await readProgress(TIME_ZONE);

    expect(before[0]?.activity).toMatchObject({ learningDays: 1, totalLessonCompletions: 1 });

    await prisma.course.delete({ where: { id: library.course.id } });
    await prisma.chapter.delete({ where: { id: library.chapter.id } });
    await prisma.lesson.delete({ where: { id: library.lesson.id } });

    await expect(prisma.step.count({ where: { lessonId: library.lesson.id } })).resolves.toBe(0);
    await expect(readProgress(TIME_ZONE)).resolves.toStrictEqual(before);
  });
});
