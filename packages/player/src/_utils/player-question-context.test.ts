import { describe, expect, it } from "vitest";
import { buildSerializedStep } from "../_test-utils/player-test-data";
import { type SelectedAnswer, type StepResult } from "../player-reducer";
import { getAnswerQuestionContext, getHeaderQuestionContext } from "./player-question-context";

const STEP = buildSerializedStep({
  content: {
    options: [
      { feedback: "Correct", id: "four", isCorrect: true, text: "4" },
      { feedback: "Try again", id: "three", isCorrect: false, text: "3" },
    ],
    question: "What is 2 + 2?",
  },
  kind: "multipleChoice",
});

const SELECTED_ANSWER = {
  kind: "multipleChoice",
  selectedOptionId: "three",
} satisfies SelectedAnswer;

function buildResult({ isCorrect }: { isCorrect: boolean }): StepResult {
  return {
    answer: SELECTED_ANSWER,
    result: { correctAnswer: "4", feedback: "Try again", isCorrect },
    stepId: STEP.id,
  };
}

describe(getHeaderQuestionContext, () => {
  it("hides general question support during graded feedback", () => {
    expect(getHeaderQuestionContext({ phase: "feedback", step: STEP, stepIndex: 2 })).toBeNull();
  });

  it("also hides general question support after a correct answer", () => {
    expect(getHeaderQuestionContext({ phase: "feedback", step: STEP, stepIndex: 2 })).toBeNull();
  });

  it("does not treat a stored result as current feedback", () => {
    expect(getHeaderQuestionContext({ phase: "playing", step: STEP, stepIndex: 2 })).toStrictEqual({
      kind: "step",
      step: STEP,
      stepIndex: 2,
    });
  });
});

describe(getAnswerQuestionContext, () => {
  it.each([false, true])("uses validated answer context when correctness is %s", (isCorrect) => {
    const result = buildResult({ isCorrect });

    expect(
      getAnswerQuestionContext({
        phase: "feedback",
        result,
        selectedAnswer: SELECTED_ANSWER,
        step: STEP,
        stepIndex: 2,
      }),
    ).toStrictEqual({
      kind: "answer",
      result,
      selectedAnswer: SELECTED_ANSWER,
      step: STEP,
      stepIndex: 2,
    });
  });

  it("does not expose an answer context before the step is checked", () => {
    expect(
      getAnswerQuestionContext({
        phase: "playing",
        result: buildResult({ isCorrect: false }),
        selectedAnswer: SELECTED_ANSWER,
        step: STEP,
        stepIndex: 2,
      }),
    ).toBeNull();
  });
});
