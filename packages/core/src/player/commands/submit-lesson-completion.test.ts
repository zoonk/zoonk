import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { dailyProgressFixtureMany, userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getPlayerProgressSnapshot } from "../queries/get-progress-snapshot";
import { submitLessonCompletion as persistLessonCompletion } from "./submit-lesson-completion";

type SubmitLessonCompletionInput = Parameters<typeof persistLessonCompletion>[0];

type TestSubmitLessonCompletionInput = Omit<SubmitLessonCompletionInput, "timeZone"> & {
  timeZone?: string;
};

/**
 * Existing command tests use UTC unless they are proving a timezone boundary.
 * Production always supplies the validated browser timezone explicitly.
 */
function submitLessonCompletion({ timeZone = "UTC", ...input }: TestSubmitLessonCompletionInput) {
  return persistLessonCompletion({ ...input, timeZone });
}

function todayLocalDate(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

describe(submitLessonCompletion, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let step: Awaited<ReturnType<typeof stepFixture>>;

  function stepResult(isCorrect: boolean) {
    return {
      answer: { kind: "multipleChoice", selectedOptionId: "a" },
      answeredAt: new Date(),
      dayOfWeek: 1,
      durationSeconds: 5,
      effects: [],
      hourOfDay: 14,
      isCorrect,
      stepId: step.id,
    };
  }

  beforeAll(async () => {
    org = await organizationFixture();
    course = await courseFixture({ isPublished: true, organizationId: org.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
    });

    lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      kind: "quiz",
      organizationId: org.id,
    });

    step = await stepFixture({
      content: {
        options: [
          { feedback: "Correct!", id: "a", isCorrect: true, text: "A" },
          { feedback: "Wrong.", id: "b", isCorrect: false, text: "B" },
        ],
      },
      kind: "multipleChoice",
      lessonId: lesson.id,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates StepAttempt records with correct fields", async () => {
    const user = await userFixture();
    const userId = user.id;

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const attempts = await prisma.stepAttempt.findMany({ where: { stepId: step.id, userId } });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.isCorrect).toBe(true);
    expect(attempts[0]?.durationSeconds).toBe(5);
    expect(attempts[0]?.hourOfDay).toBe(14);
    expect(attempts[0]?.dayOfWeek).toBe(1);
  });

  it("creates LessonProgress with completion date, timestamp, and duration", async () => {
    const user = await userFixture();
    const userId = user.id;

    await submitLessonCompletion({
      durationSeconds: 15,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 15_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const progress = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    expect(progress).not.toBeNull();
    expect(progress?.completedAt).not.toBeNull();
    expect(progress?.completedDate).toStrictEqual(parseLocalDate(todayLocalDate()));
    expect(progress?.durationSeconds).toBe(15);
  });

  it("rolls back progress writes when the lesson tree is not completable", async () => {
    const user = await userFixture();
    const userId = user.id;

    const draftCourse = await courseFixture({ organizationId: org.id });

    const draftChapter = await chapterFixture({
      courseId: draftCourse.id,
      isPublished: true,
      organizationId: org.id,
    });

    const draftLesson = await lessonFixture({
      chapterId: draftChapter.id,
      isPublished: true,
      organizationId: org.id,
    });

    await expect(
      submitLessonCompletion({
        durationSeconds: 10,
        lessonId: draftLesson.id,
        score: { brainPower: 10, correctCount: 0, energyDelta: 0.1, incorrectCount: 0 },
        startedAt: new Date(Date.now() - 10_000),
        stepResults: [],
        userId,
      }),
    ).rejects.toThrow("Lesson is not completable");

    const [courseUser, dailyProgress, lessonProgress, userProgress] = await Promise.all([
      prisma.courseUser.findUnique({ where: { courseUser: { courseId: draftCourse.id, userId } } }),
      prisma.dailyProgress.findMany({ where: { userId } }),
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: draftLesson.id, userId } },
      }),
      prisma.userProgress.findUnique({ where: { userId } }),
    ]);

    expect(courseUser).toBeNull();
    expect(dailyProgress).toHaveLength(0);
    expect(lessonProgress).toBeNull();
    expect(userProgress).toBeNull();
  });

  it("marks lesson, chapter, and course as durably completed when the final lesson is completed", async () => {
    const user = await userFixture();
    const userId = user.id;

    const publishedCourse = await courseFixture({ isPublished: true, organizationId: org.id });

    const chapter = await chapterFixture({
      courseId: publishedCourse.id,
      isPublished: true,
      organizationId: org.id,
    });

    const [firstLesson, secondLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: org.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: org.id,
        position: 1,
      }),
    ]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 20,
      lessonId: firstLesson.id,
      userId,
    });

    await submitLessonCompletion({
      durationSeconds: 15,
      lessonId: secondLesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 15_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const [lessonCompletion, chapterCompletion, courseCompletion] = await Promise.all([
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: secondLesson.id, userId } },
      }),
      prisma.chapterCompletion.findUnique({
        where: { userChapterCompletion: { chapterId: chapter.id, userId } },
      }),
      prisma.courseCompletion.findUnique({
        where: { userCourseCompletion: { courseId: publishedCourse.id, userId } },
      }),
    ]);

    expect(lessonCompletion).not.toBeNull();
    expect(chapterCompletion).not.toBeNull();
    expect(courseCompletion).not.toBeNull();
  });

  it("does not mark chapter or course complete when only the final lesson is completed", async () => {
    const user = await userFixture();
    const userId = user.id;

    const publishedCourse = await courseFixture({ isPublished: true, organizationId: org.id });

    const chapter = await chapterFixture({
      courseId: publishedCourse.id,
      isPublished: true,
      organizationId: org.id,
    });

    const [firstLesson, finalLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: org.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: org.id,
        position: 1,
      }),
    ]);

    await submitLessonCompletion({
      durationSeconds: 15,
      lessonId: finalLesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 15_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const [firstLessonCompletion, finalLessonCompletion, chapterCompletion, courseCompletion] =
      await Promise.all([
        prisma.lessonProgress.findUnique({
          where: { userLesson: { lessonId: firstLesson.id, userId } },
        }),
        prisma.lessonProgress.findUnique({
          where: { userLesson: { lessonId: finalLesson.id, userId } },
        }),
        prisma.chapterCompletion.findUnique({
          where: { userChapterCompletion: { chapterId: chapter.id, userId } },
        }),
        prisma.courseCompletion.findUnique({
          where: { userCourseCompletion: { courseId: publishedCourse.id, userId } },
        }),
      ]);

    expect(firstLessonCompletion).toBeNull();
    expect(finalLessonCompletion?.completedAt).not.toBeNull();
    expect(chapterCompletion).toBeNull();
    expect(courseCompletion).toBeNull();
  });

  it("does not mark course complete when only the final chapter is completed", async () => {
    const user = await userFixture();
    const userId = user.id;

    const publishedCourse = await courseFixture({ isPublished: true, organizationId: org.id });

    const [firstChapter, finalChapter] = await Promise.all([
      chapterFixture({
        courseId: publishedCourse.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
      }),
      chapterFixture({
        courseId: publishedCourse.id,
        isPublished: true,
        organizationId: org.id,
        position: 1,
      }),
    ]);

    const [firstChapterLesson, finalChapterLesson] = await Promise.all([
      lessonFixture({
        chapterId: firstChapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: org.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: finalChapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: org.id,
        position: 0,
      }),
    ]);

    await submitLessonCompletion({
      durationSeconds: 15,
      lessonId: finalChapterLesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 15_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const [
      firstChapterLessonCompletion,
      finalChapterCompletion,
      firstChapterCompletion,
      courseCompletion,
    ] = await Promise.all([
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: firstChapterLesson.id, userId } },
      }),
      prisma.chapterCompletion.findUnique({
        where: { userChapterCompletion: { chapterId: finalChapter.id, userId } },
      }),
      prisma.chapterCompletion.findUnique({
        where: { userChapterCompletion: { chapterId: firstChapter.id, userId } },
      }),
      prisma.courseCompletion.findUnique({
        where: { userCourseCompletion: { courseId: publishedCourse.id, userId } },
      }),
    ]);

    expect(firstChapterLessonCompletion).toBeNull();
    expect(finalChapterCompletion).not.toBeNull();
    expect(firstChapterCompletion).toBeNull();
    expect(courseCompletion).toBeNull();
  });

  it("creates UserProgress with correct BP increment and energy delta", async () => {
    const user = await userFixture();
    const userId = user.id;

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });

    expect(userProgress).not.toBeNull();
    expect(Number(userProgress?.totalBrainPower)).toBe(10);
    expect(userProgress?.currentEnergy).toBeCloseTo(0.2);
  });

  it("creates the first Energy cursor without decaying a zeroed placeholder", async () => {
    const user = await userFixture();
    const userId = user.id;
    const localDate = todayLocalDate();
    const fiveDaysBefore = new Date(parseLocalDate(localDate).getTime() - 5 * 86_400_000);

    await userProgressFixture({
      currentEnergy: 0,
      lastActiveAt: fiveDaysBefore,
      totalBrainPower: 0n,
      userId,
    });

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const dailyRecords = await prisma.dailyProgress.findMany({
      orderBy: { date: "asc" },
      where: { userId },
    });

    expect(dailyRecords).toHaveLength(1);
    expect(dailyRecords[0]?.date).toStrictEqual(parseLocalDate(localDate));
    expect(dailyRecords[0]?.energyAtEnd).toBeCloseTo(0.2);
  });

  it("starts Energy at zero when an orphaned UserProgress has no daily cursor", async () => {
    const user = await userFixture();

    await userProgressFixture({
      currentEnergy: 75,
      lastActiveAt: new Date("2026-01-01T00:00:00Z"),
      totalBrainPower: 100n,
      userId: user.id,
    });

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId: user.id,
    });

    const [dailyProgress, userProgress] = await Promise.all([
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: user.id } }),
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ]);

    expect(dailyProgress.energyAtEnd).toBeCloseTo(0.2);
    expect(userProgress.currentEnergy).toBeCloseTo(0.2);
  });

  it("creates DailyProgress with correct counters", async () => {
    const user = await userFixture();
    const userId = user.id;

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 3, energyDelta: 0.4, incorrectCount: 2 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const daily = await prisma.dailyProgress.findFirst({ where: { userId } });

    expect(daily).not.toBeNull();
    expect(daily?.correctAnswers).toBe(3);
    expect(daily?.incorrectAnswers).toBe(2);
    expect(daily?.brainPowerEarned).toBe(10);
    expect(daily?.interactiveCompleted).toBe(1);

    expect(daily?.staticCompleted).toBe(0);
  });

  it("energy clamps at 100", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));

    const user = await userFixture();
    const userId = user.id;

    await Promise.all([
      userProgressFixture({ currentEnergy: 99.5, lastActiveAt: new Date(), userId }),
      dailyProgressFixtureMany([
        {
          date: new Date("2026-07-12T00:00:00Z"),
          energyAtEnd: 99.5,
          interactiveCompleted: 1,
          userId,
        },
      ]),
    ]);

    const result = await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 5, energyDelta: 1, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(userProgress?.currentEnergy).toBe(100);
    expect(result.energyDelta).toBe(1);
  });

  it("energy clamps at 0", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));

    const user = await userFixture();
    const userId = user.id;

    await Promise.all([
      userProgressFixture({ currentEnergy: 0.05, lastActiveAt: new Date(), userId }),
      dailyProgressFixtureMany([
        {
          date: new Date("2026-07-12T00:00:00Z"),
          energyAtEnd: 0.05,
          interactiveCompleted: 1,
          userId,
        },
      ]),
    ]);

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 0, energyDelta: -0.5, incorrectCount: 5 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(false)],
      userId,
    });

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(userProgress?.currentEnergy).toBe(0);
  });

  it("floors inactivity decay at zero before applying the completion score", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));

    const user = await userFixture();

    await Promise.all([
      userProgressFixture({
        currentEnergy: 1,
        lastActiveAt: new Date("2026-07-08T12:00:00Z"),
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        {
          date: new Date("2026-07-08T00:00:00Z"),
          energyAtEnd: 1,
          interactiveCompleted: 1,
          userId: user.id,
        },
      ]),
    ]);

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date("2026-07-12T11:59:50Z"),
      stepResults: [stepResult(true)],
      userId: user.id,
    });

    const [progress, rows] = await Promise.all([
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
      prisma.dailyProgress.findMany({ orderBy: { date: "asc" }, where: { userId: user.id } }),
    ]);

    expect(progress.currentEnergy).toBeCloseTo(0.2);

    expect(rows.map(({ date, energyAtEnd }) => ({ date, energyAtEnd }))).toStrictEqual([
      { date: new Date("2026-07-08T00:00:00Z"), energyAtEnd: 1 },
      { date: new Date("2026-07-12T00:00:00Z"), energyAtEnd: 0.2 },
    ]);
  });

  it("re-completion: new StepAttempts, updated BP", async () => {
    const user = await userFixture();
    const userId = user.id;

    const baseInput = {
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    };

    await submitLessonCompletion(baseInput);
    await submitLessonCompletion(baseInput);

    const attempts = await prisma.stepAttempt.findMany({ where: { stepId: step.id, userId } });
    expect(attempts).toHaveLength(2);

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(Number(userProgress?.totalBrainPower)).toBe(20);
  });

  it("re-completion preserves the original lesson completion metadata", async () => {
    const user = await userFixture();
    const userId = user.id;

    const baseInput = {
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    };

    await submitLessonCompletion(baseInput);

    const firstProgress = await prisma.lessonProgress.findUniqueOrThrow({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    await submitLessonCompletion({ ...baseInput, durationSeconds: 25 });

    const secondProgress = await prisma.lessonProgress.findUniqueOrThrow({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    expect(secondProgress.completedAt).toStrictEqual(firstProgress.completedAt);
    expect(secondProgress.completedDate).toStrictEqual(firstProgress.completedDate);
    expect(secondProgress.durationSeconds).toBe(10);
  });

  it("static lesson increments staticCompleted, not interactiveCompleted", async () => {
    const user = await userFixture();
    const userId = user.id;

    const staticLesson = await lessonFixture({
      isPublished: true,
      kind: "explanation",
      lessonId: lesson.id,
      organizationId: org.id,
    });

    await submitLessonCompletion({
      durationSeconds: 5,
      lessonId: staticLesson.id,
      score: { brainPower: 10, correctCount: 0, energyDelta: 0.1, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 5000),
      stepResults: [],
      userId,
    });

    const daily = await prisma.dailyProgress.findFirst({ where: { userId } });

    expect(daily).not.toBeNull();
    expect(daily?.staticCompleted).toBe(1);
    expect(daily?.interactiveCompleted).toBe(0);
  });

  it("returns correct belt level based on new total BP", async () => {
    const user = await userFixture();
    const userId = user.id;

    const result = await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    expect(result.belt.color).toBe("white");
    expect(result.belt.level).toBe(1);
    expect(result.newTotalBp).toBe(10);
  });

  it("does not enroll the learner when completing a lesson", async () => {
    const user = await userFixture();
    const userId = user.id;

    const courseBefore = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const courseUser = await prisma.courseUser.findUnique({
      where: { courseUser: { courseId: course.id, userId } },
    });

    expect(courseUser).toBeNull();

    const courseAfter = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(courseAfter.userCount).toBe(courseBefore.userCount);
  });

  it("does not decay between consecutive activity dates", async () => {
    const user = await userFixture();
    const userId = user.id;

    // Anchor to UTC midnight so a midnight rollover can't shift the day count
    const today = new Date();

    const todayMidnight = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const yesterday = new Date(todayMidnight.getTime() - MS_PER_DAY);

    await Promise.all([
      userProgressFixture({ currentEnergy: 50, lastActiveAt: yesterday, userId }),
      dailyProgressFixtureMany([
        { date: yesterday, energyAtEnd: 50, interactiveCompleted: 1, userId },
      ]),
    ]);

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(userProgress?.currentEnergy).toBeCloseTo(50.2);

    const dailyRecords = await prisma.dailyProgress.findMany({
      orderBy: { date: "asc" },
      where: { userId },
    });

    expect(dailyRecords).toHaveLength(2);
    expect(dailyRecords[0]?.date).toStrictEqual(yesterday);
    expect(dailyRecords[0]?.energyAtEnd).toBe(50);
    expect(dailyRecords[1]?.date).toStrictEqual(parseLocalDate(todayLocalDate()));
    expect(dailyRecords[1]?.energyAtEnd).toBeCloseTo(50.2);
  });

  it("completes a pre-started record: sets completedAt and durationSeconds, preserves startedAt", async () => {
    const user = await userFixture();
    const userId = user.id;

    // Simulate startLesson() creating a start-only record
    await prisma.lessonProgress.create({ data: { lessonId: lesson.id, userId } });

    const startRecord = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    expect(startRecord?.completedAt).toBeNull();

    await submitLessonCompletion({
      durationSeconds: 20,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 20_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const progress = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    expect(progress?.completedAt).not.toBeNull();
    expect(progress?.completedDate).toStrictEqual(parseLocalDate(todayLocalDate()));
    expect(progress?.durationSeconds).toBe(20);
    expect(progress?.startedAt).toStrictEqual(startRecord?.startedAt);
  });

  it("applies decay without creating DailyProgress rows for inactive days", async () => {
    const user = await userFixture();
    const userId = user.id;

    const today = new Date();

    const todayMidnight = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    const fiveDaysAgo = new Date(todayMidnight.getTime() - 5 * MS_PER_DAY);

    await Promise.all([
      userProgressFixture({ currentEnergy: 50, lastActiveAt: fiveDaysAgo, userId }),
      dailyProgressFixtureMany([
        { date: fiveDaysAgo, energyAtEnd: 50, interactiveCompleted: 1, userId },
      ]),
    ]);

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    // 5 day gap → 4 inactive days → decay=4 → base=46, +0.2 → 46.2
    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(userProgress?.currentEnergy).toBeCloseTo(46.2);

    const dailyRecords = await prisma.dailyProgress.findMany({
      orderBy: { date: "asc" },
      where: { userId },
    });

    expect(dailyRecords.map(({ date, energyAtEnd }) => ({ date, energyAtEnd }))).toStrictEqual([
      { date: fiveDaysAgo, energyAtEnd: 50 },
      { date: parseLocalDate(todayLocalDate()), energyAtEnd: 46.2 },
    ]);
  });

  it("uses the server-derived local date when the learner is west of UTC", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T02:00:00Z"));

    const user = await userFixture();

    await Promise.all([
      userProgressFixture({
        currentEnergy: 50,
        lastActiveAt: new Date("2026-07-11T06:30:00Z"),
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        {
          date: new Date("2026-07-10T00:00:00Z"),
          energyAtEnd: 50,
          interactiveCompleted: 1,
          userId: user.id,
        },
      ]),
    ]);

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date("2026-07-13T01:59:50Z"),
      stepResults: [stepResult(true)],
      timeZone: "America/Los_Angeles",
      userId: user.id,
    });

    const [progress, rows] = await Promise.all([
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
      prisma.dailyProgress.findMany({ orderBy: { date: "asc" }, where: { userId: user.id } }),
    ]);

    expect(progress.currentEnergy).toBeCloseTo(49.2);

    expect(rows.map(({ date, energyAtEnd }) => ({ date, energyAtEnd }))).toStrictEqual([
      { date: new Date("2026-07-10T00:00:00Z"), energyAtEnd: 50 },
      { date: new Date("2026-07-12T00:00:00Z"), energyAtEnd: 49.2 },
    ]);
  });

  it("does not decay consecutive local dates when the learner is east of UTC", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T12:30:00Z"));

    const user = await userFixture();

    await Promise.all([
      userProgressFixture({
        currentEnergy: 50,
        lastActiveAt: new Date("2026-07-10T12:30:00Z"),
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        {
          date: new Date("2026-07-11T00:00:00Z"),
          energyAtEnd: 50,
          interactiveCompleted: 1,
          userId: user.id,
        },
      ]),
    ]);

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date("2026-07-11T12:29:50Z"),
      stepResults: [stepResult(true)],
      timeZone: "Pacific/Kiritimati",
      userId: user.id,
    });

    const progress = await prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } });

    expect(progress.currentEnergy).toBeCloseTo(50.2);
  });

  it("uses the server-derived current date when a request crosses local midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T07:00:01Z"));

    const user = await userFixture();

    await persistLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date("2026-07-12T06:59:50Z"),
      stepResults: [stepResult(true)],
      timeZone: "America/Los_Angeles",
      userId: user.id,
    });

    const daily = await prisma.dailyProgress.findFirstOrThrow({ where: { userId: user.id } });

    expect(daily.date).toStrictEqual(new Date("2026-07-12T00:00:00Z"));
  });

  it("keeps Date Line completions on their truthful daily progress date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T14:00:00Z"));

    const user = await userFixture();

    await Promise.all([
      userProgressFixture({ currentEnergy: 99.9, userId: user.id }),
      dailyProgressFixtureMany([
        {
          date: new Date("2026-07-13T00:00:00Z"),
          energyAtEnd: 99.9,
          interactiveCompleted: 1,
          userId: user.id,
        },
      ]),
    ]);

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date("2026-07-12T13:59:50Z"),
      stepResults: [stepResult(true)],
      timeZone: "Pacific/Honolulu",
      userId: user.id,
    });

    const [energyRows, fullEnergyDays, lessonProgress, progress, initialProgress] =
      await Promise.all([
        prisma.dailyProgress.findMany({ orderBy: { date: "asc" }, where: { userId: user.id } }),
        prisma.dailyProgress.count({ where: { energyAtEnd: { gte: 100 }, userId: user.id } }),
        prisma.lessonProgress.findUniqueOrThrow({
          where: { userLesson: { lessonId: lesson.id, userId: user.id } },
        }),
        prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
        getPlayerProgressSnapshot({
          bestDayRange: {
            endDate: new Date("2026-07-12T00:00:00Z"),
            startDate: new Date("2026-04-14T00:00:00Z"),
          },
          timeZone: "Pacific/Honolulu",
          today: new Date("2026-07-12T00:00:00Z"),
          userId: user.id,
        }),
      ]);

    expect(energyRows).toHaveLength(2);
    expect(energyRows[0]?.date).toStrictEqual(new Date("2026-07-12T00:00:00Z"));
    expect(energyRows[0]?.energyAtEnd).toBe(100);
    expect(energyRows[0]?.interactiveCompleted).toBe(1);
    expect(energyRows[1]?.date).toStrictEqual(new Date("2026-07-13T00:00:00Z"));
    expect(energyRows[1]?.energyAtEnd).toBe(99.9);
    expect(energyRows[1]?.interactiveCompleted).toBe(1);
    expect(fullEnergyDays).toBe(1);
    expect(lessonProgress.completedDate).toStrictEqual(new Date("2026-07-12T00:00:00Z"));
    expect(progress.currentEnergy).toBe(100);

    expect(initialProgress.progressSnapshot).toMatchObject({
      currentEnergy: 100,
      todayBrainPower: 10,
      todayCompletedLessons: 1,
      todayInteractiveLessons: 1,
    });
  });

  it("serializes concurrent Energy updates and applies inactivity decay once", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T12:00:00Z"));

    const user = await userFixture();

    await Promise.all([
      userProgressFixture({
        currentEnergy: 50,
        lastActiveAt: new Date("2026-07-09T12:00:00Z"),
        userId: user.id,
      }),
      dailyProgressFixtureMany([
        {
          date: new Date("2026-07-09T00:00:00Z"),
          energyAtEnd: 50,
          interactiveCompleted: 1,
          userId: user.id,
        },
      ]),
    ]);

    const input = {
      durationSeconds: 10,
      lessonId: lesson.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date("2026-07-12T11:59:50Z"),
      stepResults: [stepResult(true)],
      userId: user.id,
    };

    await Promise.all([submitLessonCompletion(input), submitLessonCompletion(input)]);

    const [progress, rows] = await Promise.all([
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
      prisma.dailyProgress.findMany({ orderBy: { date: "asc" }, where: { userId: user.id } }),
    ]);

    expect(progress.currentEnergy).toBeCloseTo(48.4);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.date).toStrictEqual(new Date("2026-07-09T00:00:00Z"));
    expect(rows[0]?.energyAtEnd).toBe(50);
    expect(rows[1]?.date).toStrictEqual(new Date("2026-07-12T00:00:00Z"));
    expect(rows[1]?.energyAtEnd).toBeCloseTo(48.4);
    expect(rows[1]?.interactiveCompleted).toBe(2);
  });
});
