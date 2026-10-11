import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { DAY_MS, SESSION_NOW, daysAgo } from "../../sessions/_test-utils/session-goal";
import { type MockConditions, type MockResult } from "../mocks/mock-contract";
import { getExamView } from "./get-exam-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const MOCKS = 12;
const QUESTIONS = 20;

/** A Cebraspe-style mock where the learner was right on every sure answer and no unsure one. */
function netResult(correct: number): MockResult {
  return {
    areas: [],
    blank: 0,
    calibration: {
      advice: null,
      blankingGain: 1,
      sure: { answered: 2, right: 2 },
      unsure: { answered: 1, right: 0 },
    },
    coherence: null,
    correct,
    irt: null,
    minutesUsed: 30,
    net: {
      blank: 0,
      max: QUESTIONS,
      net: correct * 2 - QUESTIONS,
      partial: 0,
      penalty: 1,
      right: correct,
      wrong: 0,
    },
    plannedMinutes: 30,
    preparation: null,
    previous: null,
    scoring: "net",
    topics: [],
    total: QUESTIONS,
    unansweredAtTimeout: 0,
  };
}

/** An exam goal with twelve finished weekly mocks (the first without calibration) and one left. */
async function historySetup() {
  const [user, blueprint] = await Promise.all([userFixture(), examBlueprintFixture()]);

  const [goal, otherGoal] = await Promise.all([
    goalFixture({ examBlueprintId: blueprint.id, kind: "exam", timezone: "UTC", userId: user.id }),
    goalFixture({ examBlueprintId: blueprint.id, kind: "exam", timezone: "UTC", userId: user.id }),
  ]);

  /** The `index`-th weekly mock, finished the day after it started. */
  const finished = ({ goalId, index }: { goalId: string; index: number }) => {
    const createdAt = daysAgo((MOCKS - index) * 7);
    const result = index === 0 ? { ...netResult(5), calibration: null } : netResult(5 + index);

    return {
      conditions: {},
      createdAt,
      finishedAt: new Date(createdAt.getTime() + DAY_MS),
      goalId,
      result,
      sectionStartedAt: createdAt,
      status: "finished" as const,
      userId: user.id,
    };
  };

  const weekly = Array.from({ length: MOCKS }, (_, index) => finished({ goalId: goal.id, index }));

  const left = { conditions: {}, createdAt: daysAgo(1), sectionStartedAt: daysAgo(1) };

  await Promise.all([
    prisma.mockExam.createMany({
      data: [
        ...weekly,
        { ...left, goalId: goal.id, status: "active", userId: user.id },
        finished({ goalId: otherGoal.id, index: 1 }),
      ],
    }),
    studySessionFixture({
      goalId: goal.id,
      localDate: daysAgo(2),
      startedAt: daysAgo(2),
      userId: user.id,
    }),
    studySessionFixture({
      goalId: goal.id,
      localDate: daysAgo(1),
      startedAt: daysAgo(1),
      userId: user.id,
    }),
    studySessionFixture({ goalId: goal.id, localDate: SESSION_NOW, userId: user.id }),
  ]);

  mockSession(user.id);
  return { goal };
}

describe("exam screen history", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists the goal's latest finished mocks newest first, each with the number it was given", async () => {
    const { goal } = await historySetup();
    const result = await getExamView({ goalId: goal.id });
    const exam = result.status === "ready" ? result.exam : null;

    expect(exam?.mocks).toHaveLength(10);

    expect(exam?.mocks.map((mock) => mock.number)).toStrictEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);

    expect(exam?.mocks[0]).toMatchObject({ correct: 16, measure: 12, scoring: "net", total: 20 });
    expect(exam?.sessionsDone).toBe(2);
  });

  it("adds up calibration across every calibrated mock, not only the ones listed", async () => {
    const { goal } = await historySetup();
    const result = await getExamView({ goalId: goal.id });

    expect(result.status === "ready" && result.exam.calibration).toMatchObject({
      blankingGain: 11,
      sure: { answered: 22, right: 22 },
      unsure: { answered: 11, right: 0 },
    });
  });
});

/** A mock that asked eight questions of each subject, with these right in each. */
function subjectResult(rightBySubject: Record<string, number>, perSubject = 16): MockResult {
  const subjects = Object.entries(rightBySubject);
  const correct = subjects.reduce((sum, [, right]) => sum + right, 0);

  return {
    ...netResult(correct),
    areas: subjects.map(([name, right]) => ({
      correct: right,
      name,
      score: null,
      secondsPerQuestion: 60,
      targetSecondsPerQuestion: null,
      total: perSubject,
    })),
    calibration: null,
    net: null,
    scoring: "raw",
    total: subjects.length * perSubject,
  };
}

/** What a mock fixed when it started, as the history reads it. */
function sat(attrs: Pick<MockConditions, "purpose" | "shape"> & { reused?: number }) {
  return {
    day: null,
    fullLength: false,
    scoring: "raw",
    sections: [],
    startTime: null,
    timeZone: null,
    ...attrs,
  };
}

/**
 * A Plus learner's four mocks, oldest first: the diagnostic one in onboarding, a Mathematics one
 * taken any time, the plan's weekly half, and the whole exam day taken any time.
 */
async function progressSetup({ plus }: { plus: boolean }) {
  const [user, blueprint] = await Promise.all([userFixture(), examBlueprintFixture()]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    timezone: "UTC",
    userId: user.id,
  });

  const taken = [
    {
      conditions: sat({ purpose: "placement", shape: null }),
      result: subjectResult({ Languages: 8, Mathematics: 4 }),
    },
    {
      conditions: sat({
        purpose: "practice",
        shape: { area: "Mathematics", day: null, kind: "area" },
      }),
      result: subjectResult({ Mathematics: 8 }),
    },
    {
      conditions: sat({ purpose: "planned", shape: null }),
      result: subjectResult({ Languages: 8, Mathematics: 10 }),
    },
    {
      conditions: sat({ purpose: "practice", shape: { area: null, day: null, kind: "full" } }),
      result: subjectResult({ Languages: 6, Mathematics: 14 }),
    },
  ];

  await Promise.all([
    prisma.mockExam.createMany({
      data: taken.map((mock, index) => ({
        ...mock,
        createdAt: daysAgo((taken.length - index) * 7),
        finishedAt: daysAgo((taken.length - index) * 7),
        goalId: goal.id,
        sectionStartedAt: daysAgo((taken.length - index) * 7),
        status: "finished" as const,
        userId: user.id,
      })),
    }),
    plus
      ? prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        })
      : null,
  ]);

  mockSession(user.id);
  return { goal, user };
}

describe("progress across mocks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows each mock's share right over time, each subject's trend, what improved and what needs work", async () => {
    const { goal } = await progressSetup({ plus: true });
    const result = await getExamView({ goalId: goal.id });
    const exam = result.status === "ready" ? result.exam : null;

    expect(exam?.progress?.mocks).toStrictEqual([
      expect.objectContaining({ number: 1, percent: 38, purpose: "placement" }),
      expect.objectContaining({
        number: 2,
        percent: 50,
        shape: expect.objectContaining({ kind: "area" }),
      }),
      expect.objectContaining({ number: 3, percent: 56, purpose: "planned" }),
      expect.objectContaining({
        number: 4,
        percent: 63,
        shape: expect.objectContaining({ kind: "full" }),
      }),
    ]);

    expect(exam?.progress?.subjects).toStrictEqual([
      { change: -12, name: "Languages", percents: [50, 50, 38] },
      { change: 63, name: "Mathematics", percents: [25, 50, 63, 88] },
    ]);

    expect(exam?.progress).toMatchObject({ improved: ["Mathematics"], needsWork: ["Languages"] });
  });

  it("draws no trend from too little evidence: few questions of a subject, or a mostly repeated mock", async () => {
    const { goal, user } = await progressSetup({ plus: true });
    const ethics = { area: "Ética", day: null, kind: "area" } as const;
    const law = { area: "Civil Law", day: null, kind: "area" } as const;

    // Eight questions of ethics twice, the second mostly repeated; then a long Civil Law mock that
    // repeated most of the first's questions.
    const later = [
      {
        conditions: sat({ purpose: "practice", shape: ethics }),
        result: subjectResult({ Ética: 4 }, 8),
      },
      {
        conditions: sat({ purpose: "practice", reused: 7, shape: ethics }),
        result: subjectResult({ Ética: 5 }, 8),
      },
      {
        conditions: sat({ purpose: "practice", shape: law }),
        result: subjectResult({ "Civil Law": 8 }, 20),
      },
      {
        conditions: sat({ purpose: "practice", reused: 15, shape: law }),
        result: subjectResult({ "Civil Law": 18 }, 20),
      },
    ];

    await prisma.mockExam.createMany({
      data: later.map((mock, index) => ({
        ...mock,
        createdAt: daysAgo(3 - index * 0.5),
        finishedAt: daysAgo(3 - index * 0.5),
        goalId: goal.id,
        sectionStartedAt: daysAgo(3 - index * 0.5),
        status: "finished" as const,
        userId: user.id,
      })),
    });

    const result = await getExamView({ goalId: goal.id });
    const progress = result.status === "ready" ? result.exam.progress : null;

    // Every mock stays on the chart; neither subject has a trend, so neither reads as better.
    expect(progress?.mocks).toHaveLength(8);
    expect(progress?.subjects.find((trend) => trend.name === "Ética")).toBeUndefined();

    expect(progress?.subjects.find((trend) => trend.name === "Civil Law")).toMatchObject({
      change: null,
      percents: [40],
    });

    expect(progress?.improved).not.toContain("Ética");
    expect(progress?.improved).not.toContain("Civil Law");
  });

  it("is a Plus feature: the free plan keeps its list of mocks and sees the progress locked", async () => {
    const { goal } = await progressSetup({ plus: false });
    const result = await getExamView({ goalId: goal.id });

    expect(result).toMatchObject({ exam: { mocksRequirePlus: true, progress: null } });
    expect(result.status === "ready" && result.exam.mocks).toHaveLength(4);
  });
});
