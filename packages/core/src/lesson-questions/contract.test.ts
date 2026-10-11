import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createLessonQuestionInputSchema } from "./contract";

const FIRST_INTEGER_ABOVE_PRISMA_RANGE = 2_147_483_648;

describe("a new lesson question's input", () => {
  it("rejects a step number outside Prisma's integer range", () => {
    const result = createLessonQuestionInputSchema.safeParse({
      context: { kind: "step", stepId: randomUUID(), stepNumber: FIRST_INTEGER_ABOVE_PRISMA_RANGE },
      question: "Can you explain this?",
      requestId: randomUUID(),
    });

    expect(result.success).toBe(false);
  });
});
