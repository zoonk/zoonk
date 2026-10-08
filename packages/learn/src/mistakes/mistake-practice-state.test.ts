import { describe, expect, it } from "vitest";
import { type PracticeEntry, createPracticeState, practiceReducer } from "./mistake-practice-state";

function entry(
  mistakeId: string,
  drill: Partial<PracticeEntry["drill"]> = {},
  questions = 2,
): PracticeEntry {
  return {
    cause: null,
    drill: { kind: "retry", lesson: null, timeLimitSeconds: null, ...drill },
    mistakeId,
    questions: Array.from({ length: questions }, (_, index) => ({
      context: null,
      format: "multipleChoice" as const,
      image: null,
      itemId: `${mistakeId}-${index}`,
      options: ["Right", "Wrong"],
      question: `Question ${index}?`,
      skillId: "skill",
      visual: null,
    })),
    snapshot: { answer: "Wrong", question: "Question 0?" },
  };
}

const LESSON = { id: "lesson", ideas: ["An idea."], title: "Lesson" };

function graded(answerId: string, fixed = false) {
  return {
    answerId,
    correctAnswer: { selectedIndex: 0 },
    explanation: null,
    fixed,
    isCorrect: true,
    trap: null,
  };
}

describe(createPracticeState, () => {
  it("opens a content gap on its idea, before its first question", () => {
    const practice = [entry("gap", { kind: "reteach", lesson: LESSON })];
    expect(createPracticeState(practice).phase).toStrictEqual({ kind: "idea" });
  });

  it("asks straight away when a gap's lesson is gone", () => {
    const practice = [entry("gap", { kind: "reteach", lesson: null })];

    expect(createPracticeState(practice).phase).toStrictEqual({
      kind: "answering",
      selected: null,
    });
  });

  it("asks straight away when a gap's lesson has no summary to show", () => {
    const practice = [entry("gap", { kind: "reteach", lesson: { ...LESSON, ideas: [] } })];

    expect(createPracticeState(practice).phase).toStrictEqual({
      kind: "answering",
      selected: null,
    });
  });

  it("shows a misread's question before its answers", () => {
    const practice = [entry("misread", { kind: "readCarefully" })];
    expect(createPracticeState(practice).phase).toStrictEqual({ kind: "reading" });
  });

  it("has nothing to play without mistakes", () => {
    expect(createPracticeState([]).phase).toStrictEqual({ kind: "ended", summary: null });
  });
});

describe(practiceReducer, () => {
  it("keeps every answer's id and each fixed mistake once, then moves on", () => {
    const practice = [
      entry("gap", { kind: "reteach", lesson: LESSON }),
      entry("misread", { kind: "readCarefully" }, 1),
    ];

    const reduce = practiceReducer;
    const answer = { selectedIndex: 0 };

    const played = [
      { type: "start" },
      { answer, timedOut: false, type: "check" },
      { feedback: graded("a1", true), mistakeId: "gap", type: "answered" },
      { type: "next" },
      { answer, timedOut: false, type: "check" },
      { feedback: graded("a2", true), mistakeId: "gap", type: "answered" },
      { type: "next" },
    ] as const;

    const state = played.reduce(
      (current, action) => reduce(current, action),
      createPracticeState(practice),
    );

    expect(state).toMatchObject({
      answerIds: ["a1", "a2"],
      fixedIds: ["gap"],
      index: 2,
      phase: { kind: "reading" },
    });

    expect(reduce(reduce(state, { type: "reveal" }), { type: "next" }).phase).toStrictEqual({
      kind: "ending",
    });
  });

  it("keeps the answer to check again when grading fails", () => {
    const practice = [entry("time", { kind: "timed", timeLimitSeconds: 45 })];
    const reduce = practiceReducer;

    const checking = reduce(createPracticeState(practice), {
      answer: { dontKnow: true },
      timedOut: true,
      type: "check",
    });

    expect(reduce(checking, { type: "answerFailed" }).phase).toStrictEqual({
      answer: { dontKnow: true },
      kind: "answerFailed",
      timedOut: true,
    });
  });
});
