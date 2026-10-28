import { randomUUID } from "node:crypto";
import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { type WrittenItemSet } from "@zoonk/ai/tasks/v2/items/write-set";

type ItemOf<FORMAT extends GeneratedItem["format"]> = Extract<GeneratedItem, { format: FORMAT }>;

export function generatedMultipleChoice(attrs?: Partial<ItemOf<"multipleChoice">>) {
  return {
    context: null,
    difficulty: "medium",
    fixedOrder: false,
    format: "multipleChoice",
    image: null,
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
    visual: null,
    ...attrs,
  } satisfies ItemOf<"multipleChoice">;
}

export function generatedTypedItem(attrs?: Partial<ItemOf<"typed">>) {
  return {
    acceptedAnswers: ["mitochondria"],
    context: null,
    difficulty: "easy",
    format: "typed",
    image: null,
    keyPoints: ["Names the mitochondria"],
    question: "Which part of the cell releases energy from food?",
    sampleAnswer: "The mitochondria.",
    visual: null,
    ...attrs,
  } satisfies ItemOf<"typed">;
}

export function generatedProvenance() {
  return {
    generatedAt: "2026-09-26T12:00:00.000Z",
    model: "openai/gpt-6-sol",
    promptVersion: "test-prompt",
    runId: `test-run-${randomUUID()}`,
  };
}

const PASSAGE = [
  "Last year the town library began opening on Sundays, after a vote in which families asked for",
  "more time to visit together. The change cost little: two librarians moved a weekday shift to",
  "the weekend. By December, visits had risen by a third, and most new visitors came with children.",
  "Weekday visits stayed the same, so the Sunday hours added readers instead of moving them.",
  "The council now wants to try the same idea at the sports centre, although its staff warn that",
  "a pool needs lifeguards, who are harder to find than librarians.",
].join(" ");

export function writtenItemSet(attrs?: Partial<WrittenItemSet>): WrittenItemSet {
  return {
    kind: "text",
    questions: [
      {
        difficulty: "easy",
        evidence: "visits had risen by a third",
        format: "trueFalse",
        isTrue: true,
        misconception: null,
        reason: "Visits rose by a third by December.",
        skill: 1,
        statement: "Opening on Sundays brought more visits to the library.",
      },
      {
        difficulty: "medium",
        evidence: "Weekday visits stayed the same",
        format: "trueFalse",
        isTrue: false,
        misconception: "Assumes visits moved to Sunday",
        reason: "Weekday visits stayed the same, so Sunday added readers.",
        skill: 2,
        statement: "The Sunday visitors were weekday readers who changed days.",
      },
      {
        difficulty: "hard",
        evidence: "a pool needs lifeguards, who are harder to find than librarians",
        format: "trueFalse",
        isTrue: true,
        misconception: null,
        reason: "The staff warn that lifeguards are harder to find.",
        skill: 1,
        statement: "The sports centre may find Sunday hours harder to staff than the library did.",
      },
    ],
    text: PASSAGE,
    title: "Sundays at the library",
    visual: null,
    ...attrs,
  };
}
