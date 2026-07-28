import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession, mockSessionFailure } from "../_test-utils/mock-session";
import { getRequestProgressDateContext } from "./get-request-date-context";
import { getScorePatterns } from "./get-score-patterns";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("./get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

/** Fixes the instant and timezone used to derive the rolling pattern window. */
function mockScoreDate(now: Date = new Date(), timeZone = "UTC") {
  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: now,
    currentInstant: now,
    timeZone,
  });
}

type AttemptGroup = {
  answeredAt: Date;
  correctAnswers: number;
  hourOfDay: number;
  incorrectAnswers: number;
  stepId: string;
  userId: string;
};

/**
 * Creates the smallest published-step dependency graph needed for persisted
 * answer attempts without relying on shared seed courses.
 */
async function createTestStep({ organizationId }: { organizationId: string }) {
  const course = await courseFixture({ organizationId });
  const chapter = await chapterFixture({ courseId: course.id, organizationId });
  const lesson = await lessonFixture({ chapterId: chapter.id, organizationId });

  return prisma.step.create({
    data: {
      content: { options: [{ feedback: "Yes", isCorrect: true, text: "A" }] },
      kind: "multipleChoice",
      lessonId: lesson.id,
      position: 0,
    },
  });
}

/**
 * Expands one time-of-day aggregate into real attempts so the SQL grouping is
 * exercised with the same row shape written by lesson completion.
 */
function getAttemptRows({
  answeredAt,
  correctAnswers,
  hourOfDay,
  incorrectAnswers,
  stepId,
  userId,
}: AttemptGroup) {
  const buildAttempt = (isCorrect: boolean) => ({
    answer: { selectedOption: isCorrect ? 1 : 0 },
    answeredAt,
    dayOfWeek: answeredAt.getDay(),
    durationSeconds: 15,
    hourOfDay,
    isCorrect,
    stepId,
    userId,
  });

  return [
    ...Array.from({ length: correctAnswers }, () => buildAttempt(true)),
    ...Array.from({ length: incorrectAnswers }, () => buildAttempt(false)),
  ];
}

describe(getScorePatterns, () => {
  it("propagates identity-provider failures", async () => {
    const error = new Error("Session lookup failed");
    mockSessionFailure(error);
    mockScoreDate();

    await expect(getScorePatterns()).rejects.toBe(error);
  });

  it("returns null for unauthenticated users", async () => {
    mockSession(null);
    mockScoreDate();

    await expect(getScorePatterns()).resolves.toBeNull();
  });

  it("returns every observed group with counts and strongest score-volume rankings", async () => {
    const [user, organization] = await Promise.all([userFixture(), organizationFixture()]);
    const step = await createTestStep({ organizationId: organization.id });
    mockSession(user.id);
    mockScoreDate(new Date("2026-01-31T23:59:59.999Z"));

    const insideRange = new Date("2026-01-15T12:00:00.000Z");
    const outsideRange = new Date("2026-02-15T12:00:00.000Z");

    const attempts = [
      ...getAttemptRows({
        answeredAt: insideRange,
        correctAnswers: 1,
        hourOfDay: 3,
        incorrectAnswers: 1,
        stepId: step.id,
        userId: user.id,
      }),
      ...getAttemptRows({
        answeredAt: insideRange,
        correctAnswers: 2,
        hourOfDay: 9,
        incorrectAnswers: 0,
        stepId: step.id,
        userId: user.id,
      }),
      ...getAttemptRows({
        answeredAt: insideRange,
        correctAnswers: 1,
        hourOfDay: 15,
        incorrectAnswers: 0,
        stepId: step.id,
        userId: user.id,
      }),
      ...getAttemptRows({
        answeredAt: outsideRange,
        correctAnswers: 10,
        hourOfDay: 21,
        incorrectAnswers: 0,
        stepId: step.id,
        userId: user.id,
      }),
    ];

    await Promise.all([
      prisma.dailyProgress.createMany({
        data: [
          {
            correctAnswers: 1,
            date: new Date("2026-01-04T00:00:00.000Z"),
            dayOfWeek: 0,
            incorrectAnswers: 1,
            userId: user.id,
          },
          {
            correctAnswers: 2,
            date: new Date("2026-01-05T00:00:00.000Z"),
            dayOfWeek: 1,
            userId: user.id,
          },
          {
            correctAnswers: 1,
            date: new Date("2026-01-06T00:00:00.000Z"),
            dayOfWeek: 2,
            userId: user.id,
          },
          {
            correctAnswers: 10,
            date: new Date("2026-02-01T00:00:00.000Z"),
            dayOfWeek: 3,
            userId: user.id,
          },
        ],
      }),
      prisma.stepAttempt.createMany({ data: attempts }),
    ]);

    const result = await getScorePatterns();

    expect(result?.weekdays).toStrictEqual([
      { correctAnswers: 1, dayOfWeek: 0, incorrectAnswers: 1, score: 50, totalAnswers: 2 },
      { correctAnswers: 2, dayOfWeek: 1, incorrectAnswers: 0, score: 100, totalAnswers: 2 },
      { correctAnswers: 1, dayOfWeek: 2, incorrectAnswers: 0, score: 100, totalAnswers: 1 },
    ]);

    expect(result?.times).toStrictEqual([
      { correctAnswers: 1, incorrectAnswers: 1, period: 0, score: 50, totalAnswers: 2 },
      { correctAnswers: 2, incorrectAnswers: 0, period: 1, score: 100, totalAnswers: 2 },
      { correctAnswers: 1, incorrectAnswers: 0, period: 2, score: 100, totalAnswers: 1 },
    ]);

    expect(result?.strongestWeekday).toStrictEqual(result?.weekdays[1]);
    expect(result?.strongestTime).toStrictEqual(result?.times[1]);
  });

  it("uses matching local-date and instant boundaries west of UTC", async () => {
    const now = new Date("2026-03-15T02:30:00.000Z");
    const timeZone = "America/Los_Angeles";
    const [user, organization] = await Promise.all([userFixture(), organizationFixture()]);
    const step = await createTestStep({ organizationId: organization.id });
    mockSession(user.id);
    mockScoreDate(now, timeZone);

    const attempts = [
      ...getAttemptRows({
        answeredAt: new Date("2025-12-15T07:59:59.999Z"),
        correctAnswers: 10,
        hourOfDay: 12,
        incorrectAnswers: 0,
        stepId: step.id,
        userId: user.id,
      }),
      ...getAttemptRows({
        answeredAt: new Date("2025-12-15T08:00:00.000Z"),
        correctAnswers: 1,
        hourOfDay: 0,
        incorrectAnswers: 1,
        stepId: step.id,
        userId: user.id,
      }),
      ...getAttemptRows({
        answeredAt: now,
        correctAnswers: 3,
        hourOfDay: 18,
        incorrectAnswers: 0,
        stepId: step.id,
        userId: user.id,
      }),
      ...getAttemptRows({
        answeredAt: new Date("2026-03-15T03:30:00.000Z"),
        correctAnswers: 0,
        hourOfDay: 19,
        incorrectAnswers: 10,
        stepId: step.id,
        userId: user.id,
      }),
    ];

    await Promise.all([
      prisma.dailyProgress.createMany({
        data: [
          {
            correctAnswers: 10,
            date: new Date("2025-12-14T00:00:00.000Z"),
            dayOfWeek: 0,
            userId: user.id,
          },
          {
            correctAnswers: 2,
            date: new Date("2025-12-15T00:00:00.000Z"),
            dayOfWeek: 1,
            userId: user.id,
          },
          {
            correctAnswers: 3,
            date: new Date("2026-03-14T00:00:00.000Z"),
            dayOfWeek: 6,
            userId: user.id,
          },
          {
            date: new Date("2026-03-15T00:00:00.000Z"),
            dayOfWeek: 0,
            incorrectAnswers: 10,
            userId: user.id,
          },
        ],
      }),
      prisma.stepAttempt.createMany({ data: attempts }),
    ]);

    const result = await getScorePatterns();

    expect(result?.weekdays).toStrictEqual([
      { correctAnswers: 2, dayOfWeek: 1, incorrectAnswers: 0, score: 100, totalAnswers: 2 },
      { correctAnswers: 3, dayOfWeek: 6, incorrectAnswers: 0, score: 100, totalAnswers: 3 },
    ]);

    expect(result?.times).toStrictEqual([
      { correctAnswers: 1, incorrectAnswers: 1, period: 0, score: 50, totalAnswers: 2 },
      { correctAnswers: 3, incorrectAnswers: 0, period: 3, score: 100, totalAnswers: 3 },
    ]);

    expect(result?.strongestWeekday).toStrictEqual(result?.weekdays[1]);
    expect(result?.strongestTime).toStrictEqual(result?.times[1]);
  });
});
