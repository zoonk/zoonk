import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { isUuid } from "@zoonk/utils/uuid";
import { describe, expect, it } from "vitest";
import {
  getAnswerExplanationRequestId,
  getLessonQuestionContextInput,
} from "./lesson-question-request";

const STEP = {
  content: {
    options: [
      { feedback: "Hidden feedback", id: "answer-a", isCorrect: true, text: "Answer A" },
      { feedback: "More hidden feedback", id: "answer-b", isCorrect: false, text: "Answer B" },
    ],
    question: "Visible question",
  },
  fillBlankOptions: [],
  id: "0198ca70-9c50-7000-8000-000000000010",
  kind: "multipleChoice",
  matchColumnsRightItems: [],
  position: 0,
  sentence: null,
  sentenceWordOptions: [],
  sortOrderItems: [],
  translationOptions: [],
  vocabularyOptions: [],
  word: null,
  wordBankOptions: [],
} satisfies SerializedStep;

function getAnswerContext(selectedOptionId: string) {
  return {
    kind: "answer" as const,
    result: {
      answer: { kind: "multipleChoice" as const, selectedOptionId },
      result: { correctAnswer: "Answer A", feedback: "Hidden feedback", isCorrect: false },
      stepId: STEP.id,
    },
    selectedAnswer: { kind: "multipleChoice" as const, selectedOptionId },
    step: STEP,
    stepIndex: 0,
  };
}

describe("lesson question requests", () => {
  it("sends only the step reference and learner answer to the trusted API boundary", () => {
    const input = getLessonQuestionContextInput({
      context: {
        kind: "answer",
        result: {
          answer: { kind: "multipleChoice", selectedOptionId: "answer-b" },
          result: { correctAnswer: "Answer A", feedback: "More hidden feedback", isCorrect: false },
          stepId: STEP.id,
        },
        selectedAnswer: { kind: "multipleChoice", selectedOptionId: "answer-b" },
        step: STEP,
        stepIndex: 0,
      },
      lessonStepIds: [STEP.id],
    });

    expect(input).toStrictEqual({
      answer: { kind: "multipleChoice", selectedOptionId: "answer-b" },
      kind: "answer",
      stepId: STEP.id,
      stepNumber: 1,
    });

    expect(JSON.stringify(input)).not.toContain("Hidden feedback");
    expect(JSON.stringify(input)).not.toContain("Answer A");
  });

  it("references every displayed review step for lesson-completion questions", () => {
    expect(
      getLessonQuestionContextInput({
        context: { kind: "lesson" },
        lessonStepIds: [STEP.id, "0198ca70-9c50-7000-8000-000000000011"],
      }),
    ).toStrictEqual({ kind: "lesson", stepIds: [STEP.id, "0198ca70-9c50-7000-8000-000000000011"] });
  });

  it("includes all 11 displayed steps in lesson-completion context", () => {
    const lessonStepIds = Array.from(
      { length: 11 },
      (_, index) => `0198ca70-9c50-7000-8000-${String(index).padStart(12, "0")}`,
    );

    expect(
      getLessonQuestionContextInput({ context: { kind: "lesson" }, lessonStepIds }),
    ).toStrictEqual({ kind: "lesson", stepIds: lessonStepIds });
  });

  it("preserves the current step number at the end of an 11-step lesson", () => {
    const lessonStepIds = Array.from(
      { length: 11 },
      (_, index) => `0198ca70-9c50-7000-8000-${String(index).padStart(12, "0")}`,
    );

    const currentStepId = lessonStepIds[10];

    if (!currentStepId) {
      throw new Error("Expected an eleventh lesson step");
    }

    expect(
      getLessonQuestionContextInput({
        context: { kind: "step", step: { ...STEP, id: currentStepId }, stepIndex: 10 },
        lessonStepIds,
      }),
    ).toStrictEqual({ kind: "step", stepId: currentStepId, stepNumber: 11 });
  });

  it("reuses one request id for the same answer explanation", async () => {
    const input = {
      context: getAnswerContext("answer-b"),
      lessonStepIds: [STEP.id],
      question: "Why was my answer wrong? Explain the correct answer.",
    };

    const firstRequestId = await getAnswerExplanationRequestId(input);
    const secondRequestId = await getAnswerExplanationRequestId(input);

    expect(firstRequestId).toBe(secondRequestId);
    expect(isUuid(firstRequestId)).toBe(true);
  });

  it("uses a different request id for a different submitted answer", async () => {
    const question = "Why was my answer wrong? Explain the correct answer.";

    const firstRequestId = await getAnswerExplanationRequestId({
      context: getAnswerContext("answer-a"),
      lessonStepIds: [STEP.id],
      question,
    });

    const secondRequestId = await getAnswerExplanationRequestId({
      context: getAnswerContext("answer-b"),
      lessonStepIds: [STEP.id],
      question,
    });

    expect(firstRequestId).not.toBe(secondRequestId);
  });
});
