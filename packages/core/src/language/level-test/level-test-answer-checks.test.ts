import { LEVEL_TEST_LEVELS } from "@zoonk/ai/tasks/language/level-test-levels";
import { levelTestQuestions } from "@zoonk/testing/fixtures/level-tests";
import { describe, expect, it } from "vitest";
import { type RecordedLevelTest, findWrongLevelTestQuestions } from "./level-test-answer-checks";
import { type LevelTestBank, type LevelTestQuestion } from "./level-test-contract";
import { getBand, getNextLevelTestStep } from "./level-test-rules";

function bankOf(): LevelTestBank {
  return { questions: levelTestQuestions(LEVEL_TEST_LEVELS), speaking: [] };
}

function recorded(start: number, picks: Record<string, number | null>): RecordedLevelTest {
  return {
    answers: Object.entries(picks).map(([id, answerIndex]) => ({ answerIndex, durationMs: 0, id })),
    startScore: start,
  };
}

/**
 * Right on B2 and C1 in both skills, so their level shows without the question under test. The
 * listening "I don't know" balances that question's reading miss, so the skills don't read apart.
 */
function strongLearner(picks: Record<string, number | null>) {
  return recorded(4, {
    "listening-B1-1": null,
    "listening-B2-0": 0,
    "listening-C1-0": 0,
    "reading-B2-0": 0,
    "reading-C1-0": 0,
    ...picks,
  });
}

/** Right at A1 and wrong at A2 in both skills. */
function weakLearner(picks: Record<string, number | null>) {
  return recorded(0, {
    "listening-A1-0": 0,
    "listening-A2-0": 1,
    "reading-A1-0": 0,
    "reading-A2-0": 1,
    ...picks,
  });
}

function times(count: number, test: () => RecordedLevelTest) {
  return Array.from({ length: count }, test);
}

function verdictFor({ id, tests }: { id: string; tests: RecordedLevelTest[] }) {
  return findWrongLevelTestQuestions({ bank: bankOf(), tests }).verdicts.find(
    (verdict) => verdict.id === id,
  );
}

describe(findWrongLevelTestQuestions, () => {
  it("removes a question whose key learners at its level reject for one other option", () => {
    const tests = times(20, () => strongLearner({ "reading-B1-0": 1 }));

    expect(verdictFor({ id: "reading-B1-0", tests })).toStrictEqual({
      group: 20,
      id: "reading-B1-0",
      picks: [0, 20, 0, 0],
      problem: "wrongKey",
    });
  });

  it("waits for 20 learners at the question's level", () => {
    const tests = times(19, () => strongLearner({ "reading-B1-0": 1 }));
    expect(verdictFor({ id: "reading-B1-0", tests })).toBeUndefined();
  });

  it("keeps a question whose other option draws learners at its level without two thirds of them", () => {
    const tests = [
      ...times(13, () => strongLearner({ "reading-B1-0": 1 })),
      ...times(7, () => strongLearner({ "reading-B1-0": 0 })),
    ];

    expect(verdictFor({ id: "reading-B1-0", tests })).toBeUndefined();
  });

  it('counts "I don\'t know" toward the group but not toward another option', () => {
    const tests = [
      ...times(14, () => strongLearner({ "reading-B1-0": 1 })),
      ...times(6, () => strongLearner({ "reading-B1-0": null })),
    ];

    expect(verdictFor({ id: "reading-B1-0", tests })).toStrictEqual({
      group: 20,
      id: "reading-B1-0",
      picks: [0, 14, 0, 0],
      problem: "wrongKey",
    });
  });

  it("removes a question that learners a band below its level almost all get right", () => {
    const tests = [
      ...times(18, () => weakLearner({ "reading-C1-1": 0 })),
      ...times(2, () => weakLearner({ "reading-C1-1": 2 })),
    ];

    expect(verdictFor({ id: "reading-C1-1", tests })).toStrictEqual({
      group: 20,
      id: "reading-C1-1",
      picks: [18, 0, 2, 0],
      problem: "easierThanItsLevel",
    });
  });

  it("keeps a question that learners a band below get right less than 90% of the time", () => {
    const tests = [
      ...times(17, () => weakLearner({ "reading-C1-1": 0 })),
      ...times(3, () => weakLearner({ "reading-C1-1": 2 })),
    ];

    expect(verdictFor({ id: "reading-C1-1", tests })).toBeUndefined();
  });

  it("ignores skipped answers and answers to questions no longer in the bank", () => {
    const tests = times(20, () =>
      strongLearner({ "listening-B1-0": 1, "reading-B1-0": 1, "reading-gone": 0 }),
    ).map((test) => ({
      ...test,
      answers: test.answers.map((answer) =>
        answer.id === "listening-B1-0" ? { ...answer, skipped: true } : answer,
      ),
    }));

    expect(verdictFor({ id: "listening-B1-0", tests })).toBeUndefined();
    expect(verdictFor({ id: "reading-B1-0", tests })).toMatchObject({ group: 20 });
  });

  it("checks nothing in a pair whose learners read and listen half a band or more apart", () => {
    const readersOnly = times(20, () =>
      recorded(2, {
        "listening-A1-0": 1,
        "listening-A2-0": 1,
        "reading-B2-1": 0,
        "reading-C1-1": 0,
      }),
    );

    const tests = [...times(20, () => strongLearner({ "reading-B1-0": 1 })), ...readersOnly];
    const { skillGap, verdicts } = findWrongLevelTestQuestions({ bank: bankOf(), tests });

    expect(skillGap).toBeLessThanOrEqual(-0.5);
    expect(verdicts).toStrictEqual([]);
  });
});

/** A fixed-seed generator, so the simulation runs the same every time. */
function seeded(seed: number) {
  let state = seed;

  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function gauss(random: () => number) {
  return Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
}

function clampLevel(score: number) {
  return Math.min(4.5, Math.max(0, score));
}

type Truth = { band?: number; key?: number };
type Learner = { abilities: Record<LevelTestQuestion["skill"], number>; start: number };

function drawLearner({ random, skillGap }: { random: () => number; skillGap: number }): Learner {
  const theta = 1.5 + 1.2 * gauss(random);
  const start = clampLevel(Math.round((theta + 0.8 * gauss(random)) * 2) / 2);

  return {
    abilities: {
      listening: clampLevel(theta + skillGap / 2),
      reading: clampLevel(theta - skillGap / 2),
    },
    start,
  };
}

function pick({
  ability,
  question,
  random,
  truth = {},
}: {
  ability: number;
  question: LevelTestQuestion;
  random: () => number;
  truth?: Truth;
}) {
  const band = truth.band ?? getBand(question.level);
  const knows = 1 / (1 + Math.exp(-1.6 * (ability - band + 0.5)));

  return random() < knows ? (truth.key ?? question.answerIndex) : Math.floor(random() * 4);
}

function takeTest({
  bank,
  faults,
  learner,
  random,
}: {
  bank: LevelTestBank;
  faults: Record<string, Truth>;
  learner: Learner;
  random: () => number;
}): RecordedLevelTest {
  const test = recorded(learner.start, {});
  const progress = { answers: test.answers, speaking: null };
  let step = getNextLevelTestStep({ bank, progress, start: learner.start });

  while (step.kind === "question") {
    const { question } = step;

    const answerIndex = pick({
      ability: learner.abilities[question.skill],
      question,
      random,
      truth: faults[question.id],
    });

    test.answers.push({ answerIndex, durationMs: 0, id: question.id });
    step = getNextLevelTestStep({ bank, progress, start: learner.start });
  }

  return test;
}

/**
 * Learners take the real adaptive test and answer from their own ability. The pair is checked
 * after every 100 tests, removing what it finds, as the daily sweep does.
 */
function simulatePair({
  faults,
  skillGap = 0,
  tests: total,
}: {
  faults: Record<string, Truth>;
  skillGap?: number;
  tests: number;
}) {
  const random = seeded(20_261_111);
  const tests: RecordedLevelTest[] = [];
  const removed: string[] = [];
  let { questions } = bankOf();

  for (let count = 1; count <= total; count += 1) {
    const bank = { questions, speaking: [] };
    tests.push(takeTest({ bank, faults, learner: drawLearner({ random, skillGap }), random }));

    if (count % 100 === 0) {
      const wrong = findWrongLevelTestQuestions({ bank, tests }).verdicts.map(({ id }) => id);
      removed.push(...wrong);
      questions = questions.filter(({ id }) => !wrong.includes(id));
    }
  }

  return removed.toSorted();
}

describe("checking a pair's questions against simulated learners", () => {
  it("removes a wrong key and a label two bands too high, and no good question", () => {
    const removed = simulatePair({
      faults: { "listening-B2-0": { band: 1 }, "reading-B1-0": { key: 1 } },
      tests: 600,
    });

    expect(removed).toStrictEqual(["listening-B2-0", "reading-B1-0"]);
  });

  it("removes no good question when learners listen two bands better than they read", () => {
    expect(simulatePair({ faults: {}, skillGap: 2, tests: 600 })).toStrictEqual([]);
  });
});
