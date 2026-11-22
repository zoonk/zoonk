import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { getLevelTestStartScore } from "./_utils/level-test-start-score";
import {
  type LevelTestBank,
  type LevelTestLength,
  type LevelTestProgress,
} from "./level-test-contract";
import {
  getBand,
  getLevelTestConfirmation,
  getLevelTestFloors,
  getLevelTestRanges,
  getLevelTestScores,
  getNextLevelTestStep,
} from "./level-test-rules";

const SKILLS = ["reading", "listening"] as const;
const SELF_REPORT = ["none", "basic", "intermediate", "advanced"] as const;

const REPORT_WEIGHTS = [
  [0.6, 0.35, 0.05, 0],
  [0.1, 0.65, 0.25, 0],
  [0, 0.25, 0.65, 0.1],
  [0, 0.05, 0.55, 0.4],
  [0, 0, 0.25, 0.75],
  [0, 0, 0.1, 0.9],
];

const BANK: LevelTestBank = {
  confirmations: SKILLS.flatMap((skill) =>
    CEFR_LEVELS.flatMap((level) =>
      Array.from({ length: 2 }, (_, index) => ({
        answerIndices: [0, 2],
        id: `confirm-${skill}-${level}-${index}`,
        level,
        options: ["a", "b", "c", "d", "e"],
        passage: "",
        question: "",
        skill,
      })),
    ),
  ),
  questions: SKILLS.flatMap((skill) =>
    CEFR_LEVELS.flatMap((level) =>
      Array.from({ length: 12 }, (_, index) => ({
        answerIndex: 0,
        id: `${skill}-${level}-${index}`,
        level,
        options: ["a", "b", "c", "d"],
        passage: "",
        question: "",
        skill,
      })),
    ),
  ),
  speaking: [],
};

function seededRandom(seed: number) {
  const state = { value: seed };

  return () => {
    state.value = (state.value * 1_664_525 + 1_013_904_223) % 2 ** 32;
    return state.value / 2 ** 32;
  };
}

function getSelfReport({ band, draw }: { band: number; draw: number }) {
  const weights = REPORT_WEIGHTS[band] ?? [];

  const position = weights.findIndex(
    (_, index) => weights.slice(0, index + 1).reduce((sum, weight) => sum + weight, 0) > draw,
  );

  return SELF_REPORT[position] ?? "advanced";
}

function runTest({
  length,
  start,
  responds,
}: {
  length: LevelTestLength;
  start: number;
  responds: (band: number, isConfirmation: boolean) => boolean;
}) {
  const answers: LevelTestProgress["answers"] = [];
  const progress = { answers, length, speaking: null };
  const input = { bank: BANK, progress, start };
  const asked: LevelTestBank["questions"][number]["level"][] = [];

  for (const _ of BANK.questions) {
    const step = getNextLevelTestStep(input);

    if (step.kind !== "question" && step.kind !== "confirmation") {
      break;
    }

    const { id, level } = step.question;
    const correct = responds(getBand(level), step.kind === "confirmation");

    if (step.kind === "question") {
      asked.push(level);
    }

    answers.push({ answerIndex: correct ? 0 : 1, correct, durationMs: 0, id });
  }

  return {
    asked,
    confirmed: getLevelTestConfirmation(input).through,
    floors: getLevelTestFloors(input),
    ranges: getLevelTestRanges(input),
    scores: getLevelTestScores(input),
  };
}

describe("matched-model level test", () => {
  it.each(
    SELF_REPORT.flatMap((level) =>
      (["quick", "wholeCourse"] as const).map((length) => ({ length, level })),
    ),
  )("can ask C2 from the $level seed in a $length test", ({ length, level }) => {
    const result = runTest({
      length,
      responds: () => true,
      start: getLevelTestStartScore({ length, level }),
    });

    expect(result.asked).toContain("C2");
    expect(result.ranges).toMatchObject({ listening: { high: "C2" }, reading: { high: "C2" } });
  });

  it.each(["quick", "wholeCourse"] as const)(
    "keeps %s estimates within a band, and saved levels and wrong skips over a learner below one percent",
    (length) => {
      const learnersPerBand = 500;

      const learners = CEFR_LEVELS.flatMap((levelLabel, band) =>
        Array.from({ length: learnersPerBand }, (_, index) => {
          const random = seededRandom(990_000 + index + band * 124_413);
          const theta = Math.min(getBand("C2"), getBand(levelLabel) + (random() < 0.5 ? 0 : 0.5));
          const level = getSelfReport({ band, draw: random() });
          const start = getLevelTestStartScore({ length, level });

          const result = runTest({
            length,
            responds: (itemBand, confirmation) => {
              const probabilityKnows = 1 / (1 + Math.exp(-2.5 * (theta - itemBand + 0.5)));
              const guess = confirmation ? 1 / 32 : 0.25;
              return random() < guess + (1 - guess) * probabilityKnows;
            },
            start,
          });

          const estimate = Math.floor(
            ((result.scores.reading ?? 0) + (result.scores.listening ?? 0)) / 2,
          );

          return {
            overplaced: SKILLS.filter((skill) => (result.floors[skill] ?? 0) > theta),
            skipped: result.confirmed !== null,
            withinOne: Math.abs(estimate - band) <= 1,
            wrongSkip: result.confirmed !== null && getBand(result.confirmed) >= theta,
          };
        }),
      );

      expect(
        learners.filter(({ withinOne }) => withinOne).length / learners.length,
      ).toBeGreaterThanOrEqual(0.9);

      expect(learners.filter(({ skipped }) => skipped).length).toBeGreaterThan(0);

      for (const skill of SKILLS) {
        expect(
          learners.filter(({ overplaced }) => overplaced.includes(skill)).length / learners.length,
        ).toBeLessThanOrEqual(0.01);
      }

      expect(
        learners.filter(({ wrongSkip }) => wrongSkip).length / learners.length,
      ).toBeLessThanOrEqual(0.01);
    },
  );
});
