import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { parseLocalDate } from "@zoonk/utils/date";
import { beforeAll, describe, expect, test } from "vitest";
import { submitLessonCompletion } from "./submit-lesson-completion";

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
    course = await courseFixture({ organizationId: org.id });
    const chapter = await chapterFixture({ courseId: course.id, organizationId: org.id });

    lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "quiz",
      organizationId: org.id,
    });

    step = await stepFixture({
      content: {
        kind: "core",
        options: [
          { feedback: "Correct!", id: "a", isCorrect: true, text: "A" },
          { feedback: "Wrong.", id: "b", isCorrect: false, text: "B" },
        ],
      },
      kind: "multipleChoice",
      lessonId: lesson.id,
    });
  });

  test("creates StepAttempt records with correct fields", async () => {
    const user = await userFixture();
    const userId = user.id;

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const attempts = await prisma.stepAttempt.findMany({
      where: { stepId: step.id, userId },
    });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.isCorrect).toBe(true);
    expect(attempts[0]?.durationSeconds).toBe(5);
    expect(attempts[0]?.hourOfDay).toBe(14);
    expect(attempts[0]?.dayOfWeek).toBe(1);
  });

  test("creates LessonProgress with completedAt and durationSeconds", async () => {
    const user = await userFixture();
    const userId = user.id;

    await submitLessonCompletion({
      durationSeconds: 15,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
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
    expect(progress?.durationSeconds).toBe(15);
  });

  test("marks lesson, chapter, and course as durably completed when the final lesson is completed", async () => {
    const user = await userFixture();
    const userId = user.id;

    const publishedCourse = await courseFixture({
      isPublished: true,
      organizationId: org.id,
    });
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
      localDate: todayLocalDate(),
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

  test("creates UserProgress with correct BP increment and energy delta", async () => {
    const user = await userFixture();
    const userId = user.id;

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
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

  test("creates DailyProgress with correct counters", async () => {
    const user = await userFixture();
    const userId = user.id;

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
      score: { brainPower: 10, correctCount: 3, energyDelta: 0.4, incorrectCount: 2 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const daily = await prisma.dailyProgress.findFirst({
      where: { userId },
    });

    expect(daily).not.toBeNull();
    expect(daily?.correctAnswers).toBe(3);
    expect(daily?.incorrectAnswers).toBe(2);
    expect(daily?.brainPowerEarned).toBe(10);
    expect(daily?.interactiveCompleted).toBe(1);

    expect(daily?.staticCompleted).toBe(0);
  });

  test("energy clamps at 100", async () => {
    const user = await userFixture();
    const userId = user.id;
    await userProgressFixture({ currentEnergy: 99.5, lastActiveAt: new Date(), userId });

    const result = await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
      score: { brainPower: 10, correctCount: 5, energyDelta: 1, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(userProgress?.currentEnergy).toBe(100);
    expect(result.energyDelta).toBe(1);
  });

  test("energy clamps at 0", async () => {
    const user = await userFixture();
    const userId = user.id;
    await userProgressFixture({ currentEnergy: 0.05, lastActiveAt: new Date(), userId });

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
      score: { brainPower: 10, correctCount: 0, energyDelta: -0.5, incorrectCount: 5 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(false)],
      userId,
    });

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(userProgress?.currentEnergy).toBe(0);
  });

  test("re-completion: new StepAttempts, updated BP", async () => {
    const user = await userFixture();
    const userId = user.id;

    const baseInput = {
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    };

    await submitLessonCompletion(baseInput);
    await submitLessonCompletion(baseInput);

    const attempts = await prisma.stepAttempt.findMany({
      where: { stepId: step.id, userId },
    });
    expect(attempts).toHaveLength(2);

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(Number(userProgress?.totalBrainPower)).toBe(20);
  });

  test("static lesson increments staticCompleted, not interactiveCompleted", async () => {
    const user = await userFixture();
    const userId = user.id;

    const staticLesson = await lessonFixture({
      kind: "explanation",
      lessonId: lesson.id,
      organizationId: org.id,
    });

    await submitLessonCompletion({
      durationSeconds: 5,
      lessonId: staticLesson.id,

      localDate: todayLocalDate(),
      score: { brainPower: 10, correctCount: 0, energyDelta: 0.1, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 5000),
      stepResults: [],
      userId,
    });

    const daily = await prisma.dailyProgress.findFirst({
      where: { userId },
    });

    expect(daily).not.toBeNull();
    expect(daily?.staticCompleted).toBe(1);
    expect(daily?.interactiveCompleted).toBe(0);
  });

  test("returns correct belt level based on new total BP", async () => {
    const user = await userFixture();
    const userId = user.id;

    const result = await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    expect(result.belt.color).toBe("white");
    expect(result.belt.level).toBe(1);
    expect(result.newTotalBp).toBe(10);
  });

  test("creates CourseUser and increments userCount on first lesson completion", async () => {
    const user = await userFixture();
    const userId = user.id;

    const courseBefore = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const courseUser = await prisma.courseUser.findUnique({
      where: { courseUser: { courseId: course.id, userId } },
    });
    expect(courseUser).not.toBeNull();

    const courseAfter = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(courseAfter.userCount).toBe(courseBefore.userCount + 1);
  });

  test("does not duplicate CourseUser or increment userCount on re-completion", async () => {
    const user = await userFixture();
    const userId = user.id;

    const baseInput = {
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    };

    await submitLessonCompletion(baseInput);
    const courseAfterFirst = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    await submitLessonCompletion(baseInput);
    const courseAfterSecond = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    // userCount should not increment on second completion
    expect(courseAfterSecond.userCount).toBe(courseAfterFirst.userCount);

    // Only one CourseUser record should exist
    const courseUsers = await prisma.courseUser.findMany({
      where: { courseId: course.id, userId },
    });
    expect(courseUsers).toHaveLength(1);
  });

  test("1-day gap: no decay, no gap records", async () => {
    const user = await userFixture();
    const userId = user.id;

    // Anchor to UTC midnight so a midnight rollover can't shift the day count
    const today = new Date();
    const todayMidnight = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const yesterday = new Date(todayMidnight.getTime() - 86_400_000);

    await userProgressFixture({
      currentEnergy: 50,
      lastActiveAt: yesterday,
      userId,
    });

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
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
    expect(dailyRecords).toHaveLength(1);
    expect(dailyRecords[0]?.date).toEqual(parseLocalDate(todayLocalDate()));
    expect(dailyRecords[0]?.energyAtEnd).toBeCloseTo(50.2);
  });

  test("completes a pre-started record: sets completedAt and durationSeconds, preserves startedAt", async () => {
    const user = await userFixture();
    const userId = user.id;

    // Simulate startLesson() creating a start-only record
    await prisma.lessonProgress.create({
      data: { lessonId: lesson.id, userId },
    });

    const startRecord = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    expect(startRecord?.completedAt).toBeNull();

    await submitLessonCompletion({
      durationSeconds: 20,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 20_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const progress = await prisma.lessonProgress.findUnique({
      where: { userLesson: { lessonId: lesson.id, userId } },
    });

    expect(progress?.completedAt).not.toBeNull();
    expect(progress?.durationSeconds).toBe(20);
    expect(progress?.startedAt).toEqual(startRecord?.startedAt);
  });

  test("stores DailyProgress date from localDate, not server UTC", async () => {
    const user = await userFixture();
    const userId = user.id;

    // Use yesterday's date so it's always within the ±48h drift window
    // but different from today to prove we use localDate, not server UTC.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const year = yesterday.getUTCFullYear();
    const month = String(yesterday.getUTCMonth() + 1).padStart(2, "0");
    const day = String(yesterday.getUTCDate()).padStart(2, "0");
    const localDate = `${year}-${month}-${day}`;

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const daily = await prisma.dailyProgress.findFirst({
      where: { userId },
    });

    expect(daily).not.toBeNull();
    expect(daily?.date).toEqual(
      new Date(
        Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()),
      ),
    );
  });

  test("rejects localDate too far in the future", async () => {
    const user = await userFixture();
    const userId = user.id;

    await expect(
      submitLessonCompletion({
        durationSeconds: 10,
        lessonId: lesson.id,

        localDate: "9999-12-31",
        score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
        startedAt: new Date(Date.now() - 10_000),
        stepResults: [stepResult(true)],
        userId,
      }),
    ).rejects.toThrow("localDate is too far from server time");
  });

  test("rejects localDate too far in the past", async () => {
    const user = await userFixture();
    const userId = user.id;

    await expect(
      submitLessonCompletion({
        durationSeconds: 10,
        lessonId: lesson.id,

        localDate: "2020-01-01",
        score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
        startedAt: new Date(Date.now() - 10_000),
        stepResults: [stepResult(true)],
        userId,
      }),
    ).rejects.toThrow("localDate is too far from server time");
  });

  test("decay uses localDate so gaps and energy stay consistent", async () => {
    const user = await userFixture();
    const userId = user.id;

    const localDate = todayLocalDate();
    const todayMs = parseLocalDate(localDate).getTime();
    const fiveDaysBefore = new Date(todayMs - 5 * 86_400_000);

    await userProgressFixture({
      currentEnergy: 50,
      lastActiveAt: fiveDaysBefore,
      userId,
    });

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate,
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

    expect(dailyRecords).toHaveLength(5);
    expect(dailyRecords[0]?.energyAtEnd).toBe(49);
    expect(dailyRecords[3]?.energyAtEnd).toBe(46);
    expect(dailyRecords[4]?.date).toEqual(parseLocalDate(localDate));
    expect(dailyRecords[4]?.energyAtEnd).toBeCloseTo(46.2);
  });

  test("applies decay and fills DailyProgress gaps for inactive days", async () => {
    const user = await userFixture();
    const userId = user.id;

    const today = new Date();
    const todayMidnight = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const fiveDaysAgo = new Date(todayMidnight.getTime() - 5 * 86_400_000);

    await userProgressFixture({
      currentEnergy: 50,
      lastActiveAt: fiveDaysAgo,
      userId,
    });

    await submitLessonCompletion({
      durationSeconds: 10,
      lessonId: lesson.id,

      localDate: todayLocalDate(),
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

    expect(dailyRecords).toHaveLength(5);

    // Decay records: energy decreases by 1 each day
    expect(dailyRecords[0]?.energyAtEnd).toBe(49);
    expect(dailyRecords[1]?.energyAtEnd).toBe(48);
    expect(dailyRecords[2]?.energyAtEnd).toBe(47);
    expect(dailyRecords[3]?.energyAtEnd).toBe(46);
    expect(dailyRecords[4]?.date).toEqual(parseLocalDate(todayLocalDate()));
    expect(dailyRecords[4]?.energyAtEnd).toBeCloseTo(46.2);
  });
});
