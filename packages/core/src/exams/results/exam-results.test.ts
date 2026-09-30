import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getGoalPreparation } from "../../preparation/get-goal-preparation";
import { getExamView } from "../view/get-exam-view";
import { examResultInputSchema } from "./exam-result-contract";
import { reportExamResult } from "./report-exam-result";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const EXAM_DAY = "2026-11-08";
const citation = { passage: "", sourceId: "notice" };

const edition = {
  citations: [],
  dates: [{ citation, date: EXAM_DAY, kind: "exam", label: "Day 1", startTime: "13:30" }],
  noticeUrl: null,
  questionCount: 180,
  sourceHash: null,
  timeZone: "America/Sao_Paulo",
  year: 2026,
};

const structure = {
  formats: [],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "Item response theory", method: "itemResponseTheory" },
    sections: [],
    timeLimitMinutes: null,
    totalQuestions: 180,
  },
  rules: [],
  subjects: [
    { citation, name: "Mathematics and its Technologies", questions: 45, topics: [], weight: null },
  ],
};

async function examGoal(name = "ENEM") {
  const user = await userFixture();
  const blueprint = await examBlueprintFixture({ edition, name, structure });

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: new Date(`${EXAM_DAY}T00:00:00Z`),
    timezone: "UTC",
    userId: user.id,
  });

  mockSession(user.id);
  return { blueprint, goal, user };
}

/** A finished mock scored with item response theory, as the result stores it. */
function irtMock({ goalId, theta, userId }: { goalId: string; theta: number; userId: string }) {
  return prisma.mockExam.create({
    data: {
      conditions: {},
      finishedAt: new Date("2026-10-20T12:00:00Z"),
      goalId,
      result: {
        areas: [],
        blank: 0,
        calibration: null,
        coherence: null,
        correct: 30,
        irt: { high: 700, low: 620, score: 660, se: 0.3, theta },
        minutesUsed: 100,
        net: null,
        plannedMinutes: 150,
        preparation: null,
        previous: null,
        scoring: "irt",
        total: 45,
        unansweredAtTimeout: 0,
      },
      sectionStartedAt: new Date("2026-10-20T10:00:00Z"),
      status: "finished",
      userId,
    },
  });
}

function accepts(scale: string, score: number): boolean {
  return examResultInputSchema.safeParse({ maxScore: null, passed: null, scale, score }).success;
}

describe("how did it go", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for the exam, then stores the result with the estimate shown before", async () => {
    const { goal, user } = await examGoal();
    const input = { maxScore: null, passed: true, scale: "irt" as const, score: 702 };

    vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    await irtMock({ goalId: goal.id, theta: 1.6, userId: user.id });

    await expect(reportExamResult({ goalId: goal.id, input })).resolves.toStrictEqual({
      status: "tooEarly",
    });

    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));

    await expect(reportExamResult({ goalId: goal.id, input })).resolves.toMatchObject({
      result: { passed: true, scale: "irt", score: 702 },
      status: "reported",
    });

    const stored = await prisma.examResult.findUniqueOrThrow({ where: { goalId: goal.id } });

    expect(stored).toMatchObject({ examName: "ENEM", mocksTaken: 1, score: 702 });
    expect(stored.estimateLow).toBeLessThan(stored.estimateHigh ?? 0);

    const view = await getExamView({ goalId: goal.id });

    expect(view).toMatchObject({
      exam: { result: { score: 702 }, scoring: { method: "irt" }, stage: "afterExam" },
      status: "ready",
    });
  });

  it("calibrates the exam's estimates once enough learners report", async () => {
    const { blueprint, goal, user } = await examGoal();
    vi.setSystemTime(new Date("2026-10-25T12:00:00Z"));
    await irtMock({ goalId: goal.id, theta: 1.6, userId: user.id });

    const before = await getGoalPreparation(goal.id);
    const uncalibrated = before.status === "ready" ? before.preparation.estimatedScore : null;

    expect(uncalibrated).toMatchObject({ calibrated: false, mocks: 1, scale: "irt" });

    const others = await Promise.all(Array.from({ length: 5 }, () => userFixture()));

    await prisma.examResult.createMany({
      data: others.map((other) => ({
        estimateHigh: 640,
        estimateLow: 600,
        examBlueprintId: blueprint.id,
        examName: "ENEM",
        scale: "irt",
        score: 680,
        userId: other.id,
      })),
    });

    mockSession(user.id);
    const after = await getGoalPreparation(goal.id);
    const calibrated = after.status === "ready" ? after.preparation.estimatedScore : null;

    expect(calibrated).toMatchObject({ calibrated: true, scale: "irt" });
    expect(calibrated?.low).toBe((uncalibrated?.low ?? 0) + 60);
  });

  it("keeps the percent estimate as points for a score reported in points, and calibrates with it", async () => {
    const { blueprint, goal, user } = await examGoal();
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));

    await learningEventFixture({
      correctAnswers: 30,
      endedAt: new Date("2026-10-20T12:00:00Z"),
      goalId: goal.id,
      incorrectAnswers: 10,
      kind: "mock",
      userId: user.id,
    });

    const input = { maxScore: 80, passed: true, scale: "points" as const, score: 64 };
    await reportExamResult({ goalId: goal.id, input });

    const stored = await prisma.examResult.findUniqueOrThrow({ where: { goalId: goal.id } });

    // 75% right in the mock is 60 of 80 points, give or take the range.
    expect(stored).toMatchObject({ maxScore: 80, scale: "points", score: 64 });
    expect(stored.estimateLow).toBeLessThan(60);
    expect(stored.estimateHigh).toBeGreaterThan(60);
    expect(stored.estimateHigh).toBeLessThanOrEqual(80);

    const others = await Promise.all(Array.from({ length: 4 }, () => userFixture()));

    await prisma.examResult.createMany({
      data: others.map((other) => ({
        estimateHigh: 64,
        estimateLow: 56,
        examBlueprintId: blueprint.id,
        examName: "ENEM",
        maxScore: 80,
        scale: "points",
        score: 72,
        userId: other.id,
      })),
    });

    mockSession(user.id);
    const preparation = await getGoalPreparation(goal.id);
    const estimate = preparation.status === "ready" ? preparation.preparation.estimatedScore : null;

    expect(estimate).toMatchObject({ calibrated: true, scale: "percent" });
  });

  it("estimates the SAT on its own scale and keeps a reported SAT score with it", async () => {
    // The SAT scores with item response theory too, but on its own scale, not ENEM's.
    const { goal, user } = await examGoal("SAT");
    vi.setSystemTime(new Date("2026-11-20T12:00:00Z"));

    await Promise.all([
      irtMock({ goalId: goal.id, theta: 0.5, userId: user.id }),
      learningEventFixture({
        correctAnswers: 30,
        endedAt: new Date("2026-10-20T12:00:00Z"),
        goalId: goal.id,
        incorrectAnswers: 10,
        kind: "mock",
        userId: user.id,
      }),
    ]);

    const view = await getExamView({ goalId: goal.id });
    const exam = view.status === "ready" ? view.exam : null;

    // 75% right, give or take, is 1170 to 1430 on the 400 to 1600 scale.
    expect(exam?.estimate).toMatchObject({ high: 1430, low: 1170, scale: "sat" });
    expect(exam?.scoring).toMatchObject({ method: "raw", scale: "sat" });

    await reportExamResult({
      goalId: goal.id,
      input: { maxScore: null, passed: null, scale: "sat", score: 1350 },
    });

    await expect(
      prisma.examResult.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ estimateHigh: 1430, estimateLow: 1170, scale: "sat", score: 1350 });
  });

  it("only takes scores the exam's scale can report", () => {
    expect(accepts("sat", 1355)).toBe(false);
    expect(accepts("toefl", 95)).toBe(false);
    expect(accepts("toefl", 4.5)).toBe(true);
  });

  it("isn't for goals that aren't exams", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "learn", userId: user.id });
    mockSession(user.id);

    await expect(
      reportExamResult({
        goalId: goal.id,
        input: { maxScore: null, passed: true, scale: null, score: null },
      }),
    ).resolves.toStrictEqual({ status: "notExam" });
  });
});
