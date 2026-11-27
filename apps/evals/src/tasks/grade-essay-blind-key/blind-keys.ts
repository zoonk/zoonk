import { type WritingPromptOutput } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { keyAspects } from "@zoonk/core/library/items/write-writing-item";
import { type GradeWritingInput } from "../grade-essay/cases/shared";
import { type SourceQuestion } from "./source-questions";

export const BLIND_KEYS_FILE = "eval-results/blind-keys/keys.json";

export const BLIND_KEY_INSTRUCTIONS = `## A question the board already set

This input also has \`givenQuestion\` and \`givenContext\`: a question the exam's board itself set for this task. Don't write a new question: copy \`givenQuestion\` into \`question\` and \`givenContext\` into \`context\` word for word, give it a \`title\`, and write the private key (\`criteria\`, \`aspects\`, \`keyPoints\`, \`sampleOutline\`, \`assessedSkillIds\`) for that question, under the rules that really govern it.`;

export type BlindKey = {
  questionId: string;
  draw: number;
  model: string;
  /** The writer's template revision, as core pins it in `getWritingKeyWriter()`. */
  promptRevision: string;
  copiedQuestion: boolean;
  costUsd: number | null;
  latencyMs: number;
  data: WritingPromptOutput;
};

export type BlindKeyFile = {
  generatedAt: string;
  appendedInstructions: string;
  spentUsd: number;
  keys: BlindKey[];
};

/**
 * The basis production saves from the writer's key (`promptContent` in core): the notice's
 * criteria and grading, the writer's aspects and key points, keyed as a practice key. The grader
 * reads the real question, since that is what the candidate answered.
 */
export function blindKeyInput({
  key,
  source,
  text,
  userInput,
}: {
  key: BlindKey;
  source: SourceQuestion;
  text: string;
  userInput: GradeWritingInput;
}): GradeWritingInput {
  const { grading } = source;
  const criterionIds = new Set(grading.criteria.map(({ id }) => id));

  if (key.data.aspects.some(({ criterionId }) => !criterionIds.has(criterionId))) {
    throw new Error(`The key for ${source.id} has an aspect outside the notice's criteria.`);
  }

  return {
    ...userInput,
    basis: {
      ...userInput.basis,
      aspects: keyAspects({ aspects: key.data.aspects, grading }),
      criteria: grading.criteria.map(({ id, points, text: name }) => ({ id, name, points })),
      grading,
      keySource: "practiceKey",
    },
    context: source.context,
    keyPoints: key.data.keyPoints,
    question: source.question,
    text,
  };
}
