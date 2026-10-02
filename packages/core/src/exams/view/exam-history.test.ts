import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { DAY_MS, SESSION_NOW, daysAgo } from "../../sessions/_test-utils/session-goal";
import { type MockResult } from "../mocks/mock-contract";
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
    net: { blank: 0, max: QUESTIONS, net: correct * 2 - QUESTIONS, right: correct, wrong: 0 },
    plannedMinutes: 30,
    preparation: null,
    previous: null,
    scoring: "net",
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
