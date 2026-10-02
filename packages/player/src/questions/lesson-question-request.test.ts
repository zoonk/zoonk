import { describe, expect, it } from "vitest";
import { type LessonQuestionContext } from "./lesson-question-context";
import { getLessonQuestionContextInput } from "./lesson-question-request";

const STEP_ID = "0198ca70-9c50-7000-8000-000000000010";

describe("lesson question requests", () => {
  it("sends only the step reference and learner answer to the trusted API boundary", () => {
    // A host may hand the tutor its whole step; none of its content may leave the device.
    const step = {
      content: { options: [{ feedback: "Hidden feedback", id: "answer-a", text: "Answer A" }] },
      id: STEP_ID,
    };

    const context: LessonQuestionContext = {
      kind: "answer",
      selectedAnswer: { kind: "multipleChoice", selectedOptionId: "answer-b" },
      step,
      stepIndex: 0,
    };

    const input = getLessonQuestionContextInput({ context, lessonStepIds: [STEP_ID] });

    expect(input).toStrictEqual({
      answer: { kind: "multipleChoice", selectedOptionId: "answer-b" },
      kind: "answer",
      stepId: STEP_ID,
      stepNumber: 1,
    });

    expect(JSON.stringify(input)).not.toContain("Hidden feedback");
    expect(JSON.stringify(input)).not.toContain("Answer A");
  });

  it("references every displayed review step for lesson-completion questions", () => {
    expect(
      getLessonQuestionContextInput({
        context: { kind: "lesson" },
        lessonStepIds: [STEP_ID, "0198ca70-9c50-7000-8000-000000000011"],
      }),
    ).toStrictEqual({ kind: "lesson", stepIds: [STEP_ID, "0198ca70-9c50-7000-8000-000000000011"] });
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
        context: { kind: "step", step: { id: currentStepId }, stepIndex: 10 },
        lessonStepIds,
      }),
    ).toStrictEqual({ kind: "step", stepId: currentStepId, stepNumber: 11 });
  });
});
