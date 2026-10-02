import { CEFR_LEVELS, clampCefrScore } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { type LevelTestBank, type LevelTestProgress } from "./level-test-contract";
import {
  LEVEL_TEST_TOTAL,
  getLevelTestScores,
  getNextLevelTestStep,
  getOverallScore,
  toLevelLabels,
} from "./level-test-rules";

const TEST_LEVELS = CEFR_LEVELS.slice(0, 5);
const A2 = 1;

const bank: LevelTestBank = {
  questions: TEST_LEVELS.flatMap((level) =>
    (["reading", "listening"] as const).flatMap((skill) =>
      [0, 1].map((index) => ({
        answerIndex: 0,
        id: `${skill}-${level}-${index}`,
        level,
        options: ["right", "b", "c", "d"],
        passage: `${skill} ${level}`,
        question: "?",
        skill,
      })),
    ),
  ),
  speaking: TEST_LEVELS.map((level) => ({ level, sentence: `Say ${level}`, translation: "" })),
};

function progress(answers: LevelTestProgress["answers"] = []): LevelTestProgress {
  return { answers, speaking: null };
}

describe("level estimates", () => {
  it("keeps the level the learner gave until they answer", () => {
    const scores = getLevelTestScores({ bank, progress: progress(), start: A2 });

    expect(scores).toStrictEqual({ listening: A2, reading: A2, writing: A2 });
  });

  it("has no speaking level until a sentence is said out loud", () => {
    const scores = getLevelTestScores({
      bank,
      progress: progress([
        { answerIndex: 0, id: "reading-A2-0" },
        { answerIndex: 1, id: "listening-A2-0" },
        { answerIndex: null, id: "reading-B1-0" },
      ]),
      start: A2,
    });

    expect(scores.speaking).toBeUndefined();
    expect(toLevelLabels(scores)).not.toHaveProperty("speaking");
    expect(scores.writing).toBe(Math.min(scores.reading, scores.listening));

    expect(getOverallScore(scores)).toBe(
      clampCefrScore((scores.reading + scores.listening + scores.writing) / 3),
    );
  });

  it("rises with right answers and falls with wrong ones", () => {
    const right = getLevelTestScores({
      bank,
      progress: progress([
        { answerIndex: 0, id: "reading-A2-0" },
        { answerIndex: 0, id: "reading-B1-0" },
      ]),
      start: A2,
    });

    const wrong = getLevelTestScores({
      bank,
      progress: progress([
        { answerIndex: 1, id: "reading-A2-0" },
        { answerIndex: null, id: "reading-A1-0" },
      ]),
      start: A2,
    });

    expect(right.reading).toBeGreaterThan(A2);
    expect(wrong.reading).toBeLessThan(A2);
  });
});

describe(getNextLevelTestStep, () => {
  it("starts with reading near the level the learner gave", () => {
    const step = getNextLevelTestStep({ bank, progress: progress(), start: A2 });

    expect(step).toMatchObject({ kind: "question", question: { level: "A2", skill: "reading" } });
  });

  it("takes turns between reading and listening", () => {
    const step = getNextLevelTestStep({
      bank,
      progress: progress([{ answerIndex: 0, id: "reading-A2-0" }]),
      start: A2,
    });

    expect(step).toMatchObject({ kind: "question", question: { skill: "listening" } });
  });

  it("asks a harder question after a right answer", () => {
    const step = getNextLevelTestStep({
      bank,
      progress: progress([
        { answerIndex: 0, id: "reading-A2-0" },
        { answerIndex: 0, id: "listening-A2-0" },
      ]),
      start: A2,
    });

    expect(step).toMatchObject({ kind: "question", question: { level: "B1", skill: "reading" } });
  });

  it("asks for one sentence out loud after the questions, then ends", () => {
    const answers = ["reading", "listening"].flatMap((skill) =>
      ["A2", "B1", "B2"].map((level) => ({ answerIndex: 0, id: `${skill}-${level}-0` })),
    );

    const speaking = getNextLevelTestStep({ bank, progress: progress(answers), start: A2 });
    expect(speaking.kind).toBe("speaking");

    const done = getNextLevelTestStep({
      bank,
      progress: { answers, speaking: { level: "B2", score: 1 } },
      start: A2,
    });

    expect(done.kind).toBe("done");
    expect(answers.length + 1).toBe(LEVEL_TEST_TOTAL);
  });
});

describe(getLevelTestScores, () => {
  it("reads speaking from the sentence and writing from the lower of reading and speaking", () => {
    const scores = getLevelTestScores({
      bank,
      progress: {
        answers: [
          { answerIndex: 0, id: "reading-B1-0" },
          { answerIndex: 0, id: "reading-B2-0" },
          { answerIndex: 1, id: "listening-A2-0" },
        ],
        speaking: { level: "A2", score: 0.5 },
      },
      start: A2,
    });

    expect(scores.reading).toBeGreaterThan(scores.listening);
    expect(scores.speaking).toBe(0.5);
    expect(scores.writing).toBe(0.5);
    expect(toLevelLabels(scores).speaking).toBe("A1+");
    expect(getOverallScore(scores)).toBeGreaterThanOrEqual(0.5);
  });
});
