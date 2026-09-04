import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MAX_LESSON_QUESTION_CONTEXT_STEPS,
  MAX_LESSON_QUESTION_STEP_NUMBER,
  createLessonQuestionInputSchema,
} from "./contract";

const createInput = (context: unknown) => ({
  context,
  question: "Can you explain this?",
  requestId: randomUUID(),
});

function parseCreateInput(context: unknown) {
  return createLessonQuestionInputSchema.safeParse(createInput(context));
}

describe(parseCreateInput, () => {
  it("accepts every displayed step in an eleven-step lesson", () => {
    const stepIds = Array.from({ length: 11 }, () => randomUUID());

    expect(parseCreateInput({ kind: "lesson", stepIds }).success).toBe(true);
  });

  it("rejects a lesson context above the provider grounding budget", () => {
    const stepIds = Array.from({ length: MAX_LESSON_QUESTION_CONTEXT_STEPS + 1 }, () =>
      randomUUID(),
    );

    expect(parseCreateInput({ kind: "lesson", stepIds }).success).toBe(false);
  });

  it("does not apply the lesson context budget to a displayed step number", () => {
    const result = parseCreateInput({
      kind: "step",
      stepId: randomUUID(),
      stepNumber: MAX_LESSON_QUESTION_CONTEXT_STEPS + 1,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a step number outside Prisma's integer range", () => {
    const result = parseCreateInput({
      kind: "step",
      stepId: randomUUID(),
      stepNumber: MAX_LESSON_QUESTION_STEP_NUMBER + 1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects the removed mistake context variant", () => {
    const result = parseCreateInput({
      answer: { kind: "multipleChoice", selectedOptionId: "wrong" },
      kind: "mistake",
      stepId: randomUUID(),
      stepNumber: 1,
    });

    expect(result.success).toBe(false);
  });
});
