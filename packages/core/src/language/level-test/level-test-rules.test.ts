import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { type LevelTestBank, type LevelTestProgress } from "./level-test-contract";
import {
  getBand,
  getLevelTestFloors,
  getLevelTestRanges,
  getLevelTestScores,
  getNextLevelTestStep,
  toLevelLabels,
} from "./level-test-rules";

const TEST_LEVELS = CEFR_LEVELS;
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

type Answer = Pick<
  LevelTestProgress["answers"][number],
  "answerIndex" | "correct" | "id" | "skipped"
>;

function progress(answers: Answer[] = []) {
  return { answers, speaking: null };
}

describe("level estimates", () => {
  it("omits every unassessed skill", () => {
    const scores = getLevelTestScores({ bank, progress: progress(), start: A2 });

    expect(scores).toStrictEqual({});
  });

  it("has no speaking level until a sentence is said out loud", () => {
    const scores = getLevelTestScores({
      bank,
      progress: progress([
        { answerIndex: 0, correct: true, id: "reading-A2-0" },
        { answerIndex: 1, correct: false, id: "listening-A2-0" },
        { answerIndex: null, correct: null, id: "reading-B1-0" },
      ]),
      start: A2,
    });

    expect(scores.speaking).toBeUndefined();
    expect(toLevelLabels(scores)).not.toHaveProperty("speaking");
  });

  it("saves no level for a stopped block", () => {
    const C1 = getBand("C1");

    const input = {
      bank,
      progress: progress([{ answerIndex: 1, correct: false, id: "reading-C1-0" }]),
      start: C1,
    };

    expect(getLevelTestRanges(input)).toStrictEqual({});
    expect(getLevelTestFloors(input)).toStrictEqual({});
  });

  it("rises with right answers and falls with wrong ones", () => {
    const right = getLevelTestScores({
      bank,
      progress: progress([
        { answerIndex: 0, correct: true, id: "reading-A2-0" },
        { answerIndex: 0, correct: true, id: "reading-B1-0" },
      ]),
      start: A2,
    });

    const wrong = getLevelTestScores({
      bank,
      progress: progress([
        { answerIndex: 1, correct: false, id: "reading-A2-0" },
        { answerIndex: null, correct: null, id: "reading-A1-0" },
      ]),
      start: A2,
    });

    expect(right.reading).toBeGreaterThan(A2);
    expect(wrong.reading).toBeLessThan(A2);
  });

  it("doesn't move for a listening question skipped because its audio couldn't be made", () => {
    const skipped = progress([
      { answerIndex: 0, correct: true, id: "reading-A2-0" },
      { answerIndex: null, correct: null, id: "listening-A2-0", skipped: true },
    ]);

    expect(getLevelTestScores({ bank, progress: skipped, start: A2 }).listening).toBeUndefined();

    expect(getNextLevelTestStep({ bank, progress: skipped, start: A2 })).toMatchObject({
      question: { skill: "reading" },
    });
  });
});

describe(getNextLevelTestStep, () => {
  it("starts with reading near the level the learner gave", () => {
    const step = getNextLevelTestStep({ bank, progress: progress(), start: A2 });

    expect(step).toMatchObject({ kind: "question", question: { level: "A2", skill: "reading" } });
  });

  it("finishes reading before asking for listening", () => {
    const step = getNextLevelTestStep({
      bank,
      progress: progress([{ answerIndex: 0, correct: true, id: "reading-A2-0" }]),
      start: A2,
    });

    expect(step).toMatchObject({ kind: "question", question: { skill: "reading" } });
  });

  it("ends only the skill with two unknown A1 answers", () => {
    const answers = [0, 1].map((index) => ({
      answerIndex: null,
      correct: null,
      id: `reading-A1-${index}`,
    }));

    const input = { bank, progress: progress(answers), start: 0 };

    expect(getNextLevelTestStep(input)).toMatchObject({
      question: { level: "A1", skill: "listening" },
    });

    expect(getLevelTestRanges(input)).toStrictEqual({ reading: { high: "A1", low: "A1" } });
  });

  it("asks the other skill when a checked bank has none left for this one", () => {
    const listeningOnly = {
      ...bank,
      questions: bank.questions.filter((question) => question.skill === "listening"),
    };

    const step = getNextLevelTestStep({ bank: listeningOnly, progress: progress(), start: A2 });

    expect(step).toMatchObject({ kind: "question", question: { skill: "listening" } });
  });

  it("asks a harder question after a right answer", () => {
    const step = getNextLevelTestStep({
      bank,
      progress: progress([
        { answerIndex: 0, correct: true, id: "reading-A2-0" },
        { answerIndex: 0, correct: true, id: "listening-A2-0" },
      ]),
      start: A2,
    });

    expect(step).toMatchObject({ kind: "question", question: { level: "B1", skill: "reading" } });
  });

  it("tries the next level down when there are too few fresh checks at the proposed level", () => {
    const answers = ["reading", "listening"].flatMap((skill) =>
      ["B1", "B2", "C1", "C2"].map((level) => ({
        answerIndex: 0,
        correct: true,
        id: `${skill}-${level}-0`,
      })),
    );

    const confirmations = (["reading", "listening"] as const).flatMap((skill) =>
      [0, 1].map((index) => ({
        answerIndices: [0, 2],
        id: `confirm-${skill}-A1-${index}`,
        level: "A1" as const,
        options: ["a", "b", "c", "d", "e"],
        passage: `${skill} ${index}`,
        question: "?",
        skill,
      })),
    );

    expect(
      getNextLevelTestStep({
        bank: { ...bank, confirmations },
        progress: progress(answers),
        start: A2,
      }),
    ).toMatchObject({ kind: "confirmation", question: { level: "A1" } });
  });

  it("finishes after four questions in each skill without asking for speech", () => {
    const answers = ["reading", "listening"].flatMap((skill) =>
      ["B1", "B2", "C1", "C2"].map((level) => ({
        answerIndex: 0,
        correct: true,
        id: `${skill}-${level}-0`,
      })),
    );

    const done = getNextLevelTestStep({ bank, progress: progress(answers), start: A2 });
    expect(done.kind).toBe("done");
  });
});
