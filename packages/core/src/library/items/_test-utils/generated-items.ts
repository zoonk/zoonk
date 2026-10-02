import { randomUUID } from "node:crypto";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";

type ItemOf<FORMAT extends GeneratedItem["format"]> = Extract<GeneratedItem, { format: FORMAT }>;

/** A generated multiple-choice item that passes the item checks. */
export function generatedMultipleChoice(attrs?: Partial<ItemOf<"multipleChoice">>) {
  return {
    context: null,
    difficulty: "medium",
    format: "multipleChoice",
    options: [
      { isCorrect: true, misconception: null, reason: "Half of 10 is 5.", text: "5" },
      {
        isCorrect: false,
        misconception: "Doubles instead of halving",
        reason: "You doubled 10 instead of halving it.",
        text: "20",
      },
    ],
    question: `What is half of 10? ${randomUUID()}`,
    ...attrs,
  } satisfies ItemOf<"multipleChoice">;
}

/** A generated typed item with an accepted short answer and key points. */
export function generatedTypedItem(attrs?: Partial<ItemOf<"typed">>) {
  return {
    acceptedAnswers: ["mitochondria"],
    context: null,
    difficulty: "easy",
    format: "typed",
    keyPoints: ["Names the mitochondria"],
    question: "Which part of the cell releases energy from food?",
    sampleAnswer: "The mitochondria.",
    ...attrs,
  } satisfies ItemOf<"typed">;
}

/** The provenance a task run returns, with a unique run id. */
export function generatedProvenance() {
  return {
    generatedAt: "2026-09-26T12:00:00.000Z",
    model: "openai/gpt-6-sol",
    promptVersion: "test-prompt",
    runId: `test-run-${randomUUID()}`,
  };
}
