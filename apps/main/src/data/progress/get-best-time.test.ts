import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, test } from "vitest";
import { getBestTime } from "./get-best-time";

type StepAttemptParams = {
  answeredAt?: Date;
  hourOfDay: number;
  isCorrect: boolean;
  orgId: number;
  stepId: number;
  userId: number;
};

function buildStepAttemptData(params: StepAttemptParams) {
  const answeredAt = params.answeredAt ?? new Date();
  return {
    answer: { selectedOption: params.isCorrect ? 1 : 0 },
    answeredAt,
    dayOfWeek: answeredAt.getDay(),
    durationSeconds: 15,
    hourOfDay: params.hourOfDay,
    isCorrect: params.isCorrect,
    organizationId: params.orgId,
    stepId: params.stepId,
    userId: params.userId,
  };
}

async function createStepAttempts(
  params: Omit<StepAttemptParams, "isCorrect">,
  correct: number,
  incorrect: number,
) {
  const correctAttempts = Array.from({ length: correct }, () =>
    buildStepAttemptData({ ...params, isCorrect: true }),
  );

  const incorrectAttempts = Array.from({ length: incorrect }, () =>
    buildStepAttemptData({ ...params, isCorrect: false }),
  );

  const allAttempts = [...correctAttempts, ...incorrectAttempts];

  await Promise.all(
    allAttempts.map((data) => prisma.stepAttempt.create({ data })),
  );
}

async function createTestStep(orgId: number) {
  const course = await courseFixture({ organizationId: orgId });
  const chapter = await chapterFixture({
    courseId: course.id,
    organizationId: orgId,
  });
  const lesson = await lessonFixture({
    chapterId: chapter.id,
    organizationId: orgId,
  });
  const activity = await activityFixture({
    lessonId: lesson.id,
    organizationId: orgId,
  });
  const step = await prisma.step.create({
    data: {
      activityId: activity.id,
      content: {},
      kind: "multiple_choice",
      position: 0,
    },
  });

  return step;
}

describe("unauthenticated users", () => {
  test("returns null", async () => {
    const result = await getBestTime({ headers: new Headers() });
    expect(result).toBeNull();
  });
});

describe("authenticated users", () => {
  test("returns null when user has no StepAttempt records", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getBestTime({ headers });
    expect(result).toBeNull();
  });

  test("returns best time when user has data for multiple periods", async () => {
    const [user, org] = await Promise.all([
      userFixture(),
      organizationFixture(),
    ]);
    const [headers, step] = await Promise.all([
      signInAs(user.email, user.password),
      createTestStep(org.id),
    ]);

    const userId = Number(user.id);
    const orgId = org.id;
    const stepId = step.id;

    await Promise.all([
      // Morning (hour 9): 9 correct, 1 incorrect = 90%
      createStepAttempts({ hourOfDay: 9, orgId, stepId, userId }, 9, 1),
      // Afternoon (hour 15): 8 correct, 2 incorrect = 80%
      createStepAttempts({ hourOfDay: 15, orgId, stepId, userId }, 8, 2),
    ]);

    const result = await getBestTime({ headers });

    expect(result).not.toBeNull();
    expect(result?.period).toBe(1); // Morning
    expect(result?.accuracy).toBe(90);
  });

  test("excludes records older than 90 days", async () => {
    const [user, org] = await Promise.all([
      userFixture(),
      organizationFixture(),
    ]);
    const [headers, step] = await Promise.all([
      signInAs(user.email, user.password),
      createTestStep(org.id),
    ]);

    const now = new Date();
    const oldDate = new Date(now);
    oldDate.setDate(oldDate.getDate() - 91);

    const userId = Number(user.id);
    const orgId = org.id;
    const stepId = step.id;

    await Promise.all([
      // Recent Morning attempts: 80%
      createStepAttempts(
        { answeredAt: now, hourOfDay: 9, orgId, stepId, userId },
        8,
        2,
      ),
      // Old Afternoon attempts: 100% (should be excluded)
      createStepAttempts(
        { answeredAt: oldDate, hourOfDay: 15, orgId, stepId, userId },
        10,
        0,
      ),
    ]);

    const result = await getBestTime({ headers });

    expect(result).not.toBeNull();
    expect(result?.period).toBe(1); // Morning
    expect(result?.accuracy).toBe(80);
  });

  test("uses period with most answers as tiebreaker", async () => {
    const [user, org] = await Promise.all([
      userFixture(),
      organizationFixture(),
    ]);
    const [headers, step] = await Promise.all([
      signInAs(user.email, user.password),
      createTestStep(org.id),
    ]);

    const userId = Number(user.id);
    const orgId = org.id;
    const stepId = step.id;

    await Promise.all([
      // Morning (hour 9): 9 correct, 1 incorrect = 90%
      createStepAttempts({ hourOfDay: 9, orgId, stepId, userId }, 9, 1),
      // Afternoon (hour 15): 18 correct, 2 incorrect = 90% (more answers)
      createStepAttempts({ hourOfDay: 15, orgId, stepId, userId }, 18, 2),
    ]);

    const result = await getBestTime({ headers });

    expect(result).not.toBeNull();
    expect(result?.period).toBe(2); // Afternoon (more answers)
    expect(result?.accuracy).toBe(90);
  });

  test("returns correct accuracy calculation", async () => {
    const [user, org] = await Promise.all([
      userFixture(),
      organizationFixture(),
    ]);
    const [headers, step] = await Promise.all([
      signInAs(user.email, user.password),
      createTestStep(org.id),
    ]);

    const userId = Number(user.id);
    const orgId = org.id;
    const stepId = step.id;

    // 17 correct, 3 incorrect = 85%
    await createStepAttempts({ hourOfDay: 21, orgId, stepId, userId }, 17, 3);

    const result = await getBestTime({ headers });

    expect(result).not.toBeNull();
    expect(result?.period).toBe(3); // Evening
    expect(result?.accuracy).toBe(85);
  });

  test("correctly maps hours to periods", async () => {
    const [user, org] = await Promise.all([
      userFixture(),
      organizationFixture(),
    ]);
    const [headers, step] = await Promise.all([
      signInAs(user.email, user.password),
      createTestStep(org.id),
    ]);

    const userId = Number(user.id);
    const orgId = org.id;
    const stepId = step.id;

    // Night (hour 3): 100%
    await createStepAttempts({ hourOfDay: 3, orgId, stepId, userId }, 1, 0);

    const result = await getBestTime({ headers });

    expect(result).not.toBeNull();
    expect(result?.period).toBe(0); // Night
    expect(result?.accuracy).toBe(100);
  });

  test("filters by custom date range when startDate is provided", async () => {
    const [user, org] = await Promise.all([
      userFixture(),
      organizationFixture(),
    ]);
    const [headers, step] = await Promise.all([
      signInAs(user.email, user.password),
      createTestStep(org.id),
    ]);

    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const userId = Number(user.id);
    const orgId = org.id;
    const stepId = step.id;

    await Promise.all([
      // Recent Morning attempts: 80%
      createStepAttempts(
        { answeredAt: now, hourOfDay: 9, orgId, stepId, userId },
        8,
        2,
      ),
      // Older Afternoon attempts: 100% (should be excluded with custom range)
      createStepAttempts(
        { answeredAt: twoWeeksAgo, hourOfDay: 15, orgId, stepId, userId },
        10,
        0,
      ),
    ]);

    // Filter to only include data from the past week
    const result = await getBestTime({
      headers,
      startDate: oneWeekAgo,
    });

    expect(result).not.toBeNull();
    expect(result?.period).toBe(1); // Morning (only recent data)
    expect(result?.accuracy).toBe(80);
  });
});
