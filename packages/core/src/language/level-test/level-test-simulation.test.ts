import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { getLevelTestEnd } from "./_utils/level-test-end";
import { getLevelTestPlanningStart } from "./_utils/level-test-planning-start";
import { getLevelTestStart } from "./_utils/level-test-start-score";
import { type LevelTestBank, type LevelTestProgress } from "./level-test-contract";
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

type Skill = (typeof SKILLS)[number];

function runTest({
  start,
  firstBand,
  responds,
  stopAfter = Infinity,
  defer,
}: {
  start: number;
  firstBand?: number;
  stopAfter?: number;
  defer?: "question" | "confirmation";
  responds: (band: number, confirmation: boolean, skill: Skill) => boolean;
}) {
  const answers: LevelTestProgress["answers"] = [];
  const input = { bank: BANK, progress: { answers, firstBand, speaking: null }, start };
  const skills: Skill[] = [];

  while (answers.length < stopAfter) {
    const step = getNextLevelTestStep(input);

    if (step.kind === "done") {
      break;
    }

    if (answers.length >= 12) {
      throw new Error("Question ceiling exceeded");
    }

    const { id, level, skill } = step.question;

    if (step.kind === "question") {
      skills.push(skill);
    }

    if (defer === step.kind && skill === "listening") {
      answers.push({ answerIndex: null, audioDeferred: true, durationMs: 0, id, skipped: true });
    } else {
      const correct = responds(getBand(level), step.kind === "confirmation", skill);
      answers.push({ answerIndex: correct ? 0 : 1, correct, durationMs: 0, id });
    }
  }

  const confirmed = getLevelTestConfirmation(input).through;

  return {
    answered: answers.length,
    confirmed,
    end: getLevelTestEnd(input),
    floors: getLevelTestFloors(input),
    planningStart: getLevelTestPlanningStart(input, firstBand ?? start, confirmed ?? undefined),
    ranges: getLevelTestRanges(input),
    scores: getLevelTestScores(input),
    skills,
  };
}

describe("matched-model level test", () => {
  it("completes reading before listening and retains only completed blocks on an interruption", () => {
    const learner = { responds: () => true, start: 4 };

    expect(runTest(learner).skills).toStrictEqual([
      "reading",
      "reading",
      "reading",
      "reading",
      "listening",
      "listening",
      "listening",
      "listening",
    ]);

    expect(runTest({ ...learner, stopAfter: 2 })).toMatchObject({
      end: "stopped",
      planningStart: null,
      ranges: {},
    });

    const partial = runTest({ ...learner, defer: "question" });
    expect(Object.keys(partial.ranges)).toStrictEqual(["reading"]);
    expect(partial).toMatchObject({ confirmed: null, end: "audio_deferred", planningStart: null });
  });

  it("keeps both levels on a missed or deferred check and grants no skip", () => {
    const learner = { responds: () => true, start: 4 };
    const missed = runTest({ ...learner, responds: (_band, check) => !check });
    const deferred = runTest({ ...learner, defer: "confirmation" });
    expect(missed).toMatchObject({ answered: 9, confirmed: null, end: "check_missed" });

    expect(deferred).toMatchObject({
      answered: 11,
      confirmed: null,
      end: "audio_deferred",
      ranges: missed.ranges,
    });

    expect(Object.keys(deferred.ranges)).toStrictEqual(["reading", "listening"]);
  });

  it.each([
    { stated: true, unequal: false },
    { stated: true, unequal: true },
    { stated: false, unequal: false },
    { stated: false, unequal: true },
  ])("measures placement with unequal=$unequal and stated=$stated", ({ unequal, stated }) => {
    const rows = CEFR_LEVELS.flatMap((_level, band) =>
      Array.from({ length: 500 }, (_, index) => {
        const random = seededRandom(990_000 + index + band * 124_413);
        const theta = Math.min(5, band + (random() < 0.5 ? 0 : 0.5));
        const report = getSelfReport({ band, draw: random() });
        const listening = unequal && random() < 0.5 ? Math.max(0, theta - 1) : theta;

        const result = runTest({
          responds: (itemBand, check, skill) => {
            const knows =
              1 /
              (1 + Math.exp(-2.5 * ((skill === "reading" ? theta : listening) - itemBand + 0.5)));

            const guess = check ? 1 / 32 : 0.25;
            return random() < guess + (1 - guess) * knows;
          },
          ...getLevelTestStart(stated ? report : null),
        });

        const skipped = result.confirmed === null ? 0 : getBand(result.confirmed) + 1;

        const estimate = Math.floor(
          ((result.scores.reading ?? 0) + (result.scores.listening ?? 0)) / 2,
        );

        const startError = (result.planningStart ?? -1) / 2 - Math.floor(listening / 2);

        return {
          high: startError > 0,
          low: startError < 0,
          overListening: (result.floors.listening ?? 0) > listening,
          overReading: (result.floors.reading ?? 0) > theta,
          right: startError === 0,
          skippable: Math.floor(listening),
          skipped,
          within: Math.abs(estimate - band) <= 1,
          wrongSkip: skipped - 1 >= listening,
        };
      }),
    );

    const share = (
      key: "within" | "overReading" | "overListening" | "wrongSkip" | "right" | "high" | "low",
    ) => rows.filter((row) => row[key]).length / rows.length;

    const skipShare =
      rows.reduce((sum, row) => sum + row.skipped, 0) /
      rows.reduce((sum, row) => sum + row.skippable, 0);

    process.stdout.write(
      `${JSON.stringify({
        high: share("high"),
        low: share("low"),
        overListening: share("overListening"),
        overReading: share("overReading"),
        right: share("right"),
        skipShare,
        stated,
        unequal,
        within: share("within"),
        wrongSkip: share("wrongSkip"),
      })}\n`,
    );

    expect(share("within")).toBeGreaterThanOrEqual(stated ? 0.9 : 0.6);
    expect(share("overReading")).toBeLessThanOrEqual(0.01);
    expect(share("overListening")).toBeLessThanOrEqual(0.01);
    expect(share("wrongSkip")).toBeLessThanOrEqual(0.01);
    expect(skipShare).toBeGreaterThan(0);
    expect(share("right")).toBeGreaterThanOrEqual(stated ? 0.8 : 0.5);
  });
});
