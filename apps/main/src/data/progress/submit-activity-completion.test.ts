import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { submitActivityCompletion } from "./submit-activity-completion";

describe(submitActivityCompletion, () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;
  let activity: Awaited<ReturnType<typeof activityFixture>>;
  let step: Awaited<ReturnType<typeof stepFixture>>;

  function stepResult(isCorrect: boolean) {
    return {
      answer: { kind: "multipleChoice", selectedIndex: 0 },
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
    lesson = await lessonFixture({ chapterId: chapter.id, organizationId: org.id });

    activity = await activityFixture({
      kind: "quiz",
      lessonId: lesson.id,
      organizationId: org.id,
    });

    step = await stepFixture({
      activityId: activity.id,
      content: {
        kind: "core",
        options: [
          { feedback: "Correct!", isCorrect: true, text: "A" },
          { feedback: "Wrong.", isCorrect: false, text: "B" },
        ],
      },
      kind: "multipleChoice",
    });
  });

  test("creates StepAttempt records with correct fields", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const attempts = await prisma.stepAttempt.findMany({
      where: { stepId: step.id, userId },
    });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.isCorrect).toBeTruthy();
    expect(attempts[0]?.durationSeconds).toBe(5);
    expect(attempts[0]?.hourOfDay).toBe(14);
    expect(attempts[0]?.dayOfWeek).toBe(1);
  });

  test("creates ActivityProgress with completedAt and durationSeconds", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 15,
      isChallenge: false,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 15_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const progress = await prisma.activityProgress.findUnique({
      where: { userActivity: { activityId: activity.id, userId } },
    });

    expect(progress).not.toBeNull();
    expect(progress?.completedAt).not.toBeNull();
    expect(progress?.durationSeconds).toBe(15);
  });

  test("creates UserProgress with correct BP increment and energy delta", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
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
    const userId = Number(user.id);

    await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 3, energyDelta: 0.4, incorrectCount: 2 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const daily = await prisma.dailyProgress.findFirst({
      where: { organizationId: org.id, userId },
    });

    expect(daily).not.toBeNull();
    expect(daily?.correctAnswers).toBe(3);
    expect(daily?.incorrectAnswers).toBe(2);
    expect(daily?.brainPowerEarned).toBe(10);
    expect(daily?.interactiveCompleted).toBe(1);
    expect(daily?.challengesCompleted).toBe(0);
    expect(daily?.staticCompleted).toBe(0);
  });

  test("energy clamps at 100", async () => {
    const user = await userFixture();
    const userId = Number(user.id);
    await userProgressFixture({ currentEnergy: 99.5, lastActiveAt: new Date(), userId });

    const result = await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
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
    const userId = Number(user.id);
    await userProgressFixture({ currentEnergy: 0.05, lastActiveAt: new Date(), userId });

    await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 0, energyDelta: -0.5, incorrectCount: 5 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(false)],
      userId,
    });

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(userProgress?.currentEnergy).toBe(0);
  });

  test("challenge success: 100 BP", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    const result = await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: true,
      organizationId: org.id,
      score: { brainPower: 100, correctCount: 0, energyDelta: 3, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    expect(result.brainPower).toBe(100);

    const daily = await prisma.dailyProgress.findFirst({
      where: { organizationId: org.id, userId },
    });

    expect(daily?.challengesCompleted).toBe(1);
    expect(daily?.interactiveCompleted).toBe(0);
  });

  test("challenge failure: 10 BP, energy +0.1", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    const result = await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: true,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 0, energyDelta: 0.1, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    expect(result.brainPower).toBe(10);
    expect(result.energyDelta).toBe(0.1);
  });

  test("re-completion: new StepAttempts, updated BP", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    const baseInput = {
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    };

    await submitActivityCompletion(baseInput);
    await submitActivityCompletion(baseInput);

    const attempts = await prisma.stepAttempt.findMany({
      where: { stepId: step.id, userId },
    });
    expect(attempts).toHaveLength(2);

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(Number(userProgress?.totalBrainPower)).toBe(20);
  });

  test("static activity increments staticCompleted, not interactiveCompleted", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    const staticActivity = await activityFixture({
      kind: "background",
      lessonId: lesson.id,
      organizationId: org.id,
    });

    await submitActivityCompletion({
      activityId: staticActivity.id,
      courseId: course.id,
      durationSeconds: 5,
      isChallenge: false,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 0, energyDelta: 0.1, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 5000),
      stepResults: [],
      userId,
    });

    const daily = await prisma.dailyProgress.findFirst({
      where: { organizationId: org.id, userId },
    });

    expect(daily).not.toBeNull();
    expect(daily?.staticCompleted).toBe(1);
    expect(daily?.interactiveCompleted).toBe(0);
    expect(daily?.challengesCompleted).toBe(0);
  });

  test("returns correct belt level based on new total BP", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    const result = await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    expect(result.belt.color).toBe("white");
    expect(result.belt.level).toBe(1);
    expect(result.newTotalBp).toBe(10);
  });

  test("null organizationId: creates DailyProgress without org", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: null,
      score: { brainPower: 10, correctCount: 2, energyDelta: 0.3, incorrectCount: 1 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const daily = await prisma.dailyProgress.findFirst({
      where: { organizationId: null, userId },
    });

    expect(daily).not.toBeNull();
    expect(daily?.correctAnswers).toBe(2);
    expect(daily?.incorrectAnswers).toBe(1);
    expect(daily?.brainPowerEarned).toBe(10);
    expect(daily?.interactiveCompleted).toBe(1);
  });

  test("null organizationId: increments existing DailyProgress on second completion", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    const baseInput = {
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: null as number | null,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    };

    await submitActivityCompletion(baseInput);
    await submitActivityCompletion(baseInput);

    const dailyRecords = await prisma.dailyProgress.findMany({
      where: { organizationId: null, userId },
    });

    expect(dailyRecords).toHaveLength(1);
    expect(dailyRecords[0]?.brainPowerEarned).toBe(20);
    expect(dailyRecords[0]?.correctAnswers).toBe(2);
    expect(dailyRecords[0]?.interactiveCompleted).toBe(2);
  });

  test("null organizationId: creates StepAttempt without org", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: null,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const attempts = await prisma.stepAttempt.findMany({
      where: { organizationId: null, stepId: step.id, userId },
    });

    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.organizationId).toBeNull();
  });

  test("creates CourseUser and increments userCount on first activity completion", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    const courseBefore = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
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
    const userId = Number(user.id);

    const baseInput = {
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    };

    await submitActivityCompletion(baseInput);
    const courseAfterFirst = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    await submitActivityCompletion(baseInput);
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
    const userId = Number(user.id);

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    await userProgressFixture({
      currentEnergy: 50,
      lastActiveAt: yesterday,
      userId,
    });

    await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(userProgress?.currentEnergy).toBeCloseTo(50.2);

    // No decay gap records should exist (only today's org-scoped record)
    const decayRecords = await prisma.dailyProgress.findMany({
      where: { organizationId: null, userId },
    });
    expect(decayRecords).toHaveLength(0);
  });

  test("applies decay and fills DailyProgress gaps for inactive days", async () => {
    const user = await userFixture();
    const userId = Number(user.id);

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setUTCDate(fiveDaysAgo.getUTCDate() - 5);

    await userProgressFixture({
      currentEnergy: 50,
      lastActiveAt: fiveDaysAgo,
      userId,
    });

    await submitActivityCompletion({
      activityId: activity.id,
      courseId: course.id,
      durationSeconds: 10,
      isChallenge: false,
      organizationId: org.id,
      score: { brainPower: 10, correctCount: 1, energyDelta: 0.2, incorrectCount: 0 },
      startedAt: new Date(Date.now() - 10_000),
      stepResults: [stepResult(true)],
      userId,
    });

    // 5 day gap → 4 inactive days → decay=4 → base=46, +0.2 → 46.2
    const userProgress = await prisma.userProgress.findUnique({ where: { userId } });
    expect(userProgress?.currentEnergy).toBeCloseTo(46.2);

    // Should have 4 decay DailyProgress records (one per inactive day) + 1 for today
    const dailyRecords = await prisma.dailyProgress.findMany({
      orderBy: { date: "asc" },
      where: { organizationId: null, userId },
    });

    expect(dailyRecords).toHaveLength(4);

    // Decay records: energy decreases by 1 each day
    expect(dailyRecords[0]?.energyAtEnd).toBe(49);
    expect(dailyRecords[1]?.energyAtEnd).toBe(48);
    expect(dailyRecords[2]?.energyAtEnd).toBe(47);
    expect(dailyRecords[3]?.energyAtEnd).toBe(46);

    // Today's record is in the org-scoped DailyProgress
    const todayRecord = await prisma.dailyProgress.findFirst({
      where: { organizationId: org.id, userId },
    });
    expect(todayRecord?.energyAtEnd).toBeCloseTo(46.2);
  });
});
