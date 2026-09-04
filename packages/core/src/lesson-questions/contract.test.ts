import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createLessonQuestionInputSchema } from "./contract";

const FIRST_INTEGER_ABOVE_PRISMA_RANGE = 2_147_483_648;

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

  it("accepts a displayed step number in a long lesson", () => {
    const result = parseCreateInput({ kind: "step", stepId: randomUUID(), stepNumber: 51 });

    expect(result.success).toBe(true);
  });

  it("rejects a step number outside Prisma's integer range", () => {
    const result = parseCreateInput({
      kind: "step",
      stepId: randomUUID(),
      stepNumber: FIRST_INTEGER_ABOVE_PRISMA_RANGE,
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
