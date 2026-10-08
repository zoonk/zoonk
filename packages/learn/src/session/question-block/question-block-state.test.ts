import { describe, expect, it } from "vitest";
import { type StudyAnswerFeedback, type StudyBlockDetail } from "../session-types";
import {
  type QuestionBlockState,
  createQuestionBlockState,
  questionBlockReducer,
} from "./question-block-state";

function question(itemId: string, answered: { blank: boolean; isCorrect: boolean } | null = null) {
  return {
    answered,
    capsuleKey: null,
    citation: null,
    context: null,
    drill: null,
    format: "multipleChoice" as const,
    image: null,
    itemId,
    left: null,
    mistakeId: null,
    options: ["A", "B"],
    placement: false,
    question: `Question ${itemId}?`,
    quoted: false,
    right: null,
    skillId: "skill",
    timeMachine: null,
    unit: null,
    visual: null,
  };
}

const BLOCK: StudyBlockDetail["block"] = {
  answered: 0,
  brainPower: 0,
  canDo: null,
  capsules: [],
  chapterId: null,
  checkpoint: null,
  estimatedBrainPower: 10,
  estimatedMinutes: 4,
  extra: false,
  fullReview: false,
  id: "block",
  kind: "practice",
  lessonId: null,
  netScored: false,
  oftenTested: false,
  planItemId: null,
  position: 0,
  questions: 2,
  reinforcement: false,
  status: "active",
  subject: null,
  title: null,
};

function detailWith(questions: ReturnType<typeof question>[]): StudyBlockDetail {
  return { block: BLOCK, hints: true, questions, trueFalseLabels: "trueFalse" };
}

const feedback: StudyAnswerFeedback = {
  blank: false,
  correctAnswer: { selectedIndex: 0 },
  explanation: "Because.",
  hyperdrive: { level: 2, streak: 3 },
  isCorrect: true,
  mistakeFixed: false,
  pauseSuggested: false,
  savedToNotebook: false,
  trap: null,
  workedSteps: [],
};

describe(createQuestionBlockState, () => {
  it("resumes at the first question not answered yet", () => {
    const state = createQuestionBlockState(
      detailWith([question("a", { blank: false, isCorrect: true }), question("b"), question("c")]),
    );

    expect(state.index).toBe(1);
    expect(state.phase).toStrictEqual({ kind: "answering" });
  });

  it("goes straight to the block's end when every question was answered", () => {
    const state = createQuestionBlockState(
      detailWith([
        question("a", { blank: false, isCorrect: true }),
        question("b", { blank: false, isCorrect: false }),
      ]),
    );

    expect(state.phase).toStrictEqual({ kind: "finishing" });
  });
});

describe(questionBlockReducer, () => {
  const reduce = questionBlockReducer(2);

  const start: QuestionBlockState = createQuestionBlockState(
    detailWith([question("a"), question("b")]),
  );

  it("shows the grade after an answer and carries Hyperdrive", () => {
    const checking = reduce(start, { type: "check" });

    const graded = reduce(checking, {
      answer: { selectedIndex: 0 },
      feedback,
      itemId: "a",
      type: "answered",
    });

    expect(graded.phase).toMatchObject({ kind: "feedback" });
    expect(graded.hyperdrive).toBe(2);

    expect(graded.answers).toStrictEqual({
      a: { answer: { selectedIndex: 0 }, blank: false, isCorrect: true },
    });
  });

  it("moves to the next question, and to the end after the last one", () => {
    const second = reduce(start, { type: "next" });
    expect(second).toMatchObject({ index: 1, phase: { kind: "answering" } });

    const end = reduce(second, { type: "next" });
    expect(end).toMatchObject({ index: 2, phase: { kind: "finishing" } });
  });

  it("keeps the question open when an answer couldn't be saved", () => {
    const failed = reduce(start, { retryAfterSeconds: 30, type: "answerFailed" });

    expect(failed.index).toBe(0);
    expect(failed.phase).toStrictEqual({ kind: "answerFailed", retryAfterSeconds: 30 });
  });
});
