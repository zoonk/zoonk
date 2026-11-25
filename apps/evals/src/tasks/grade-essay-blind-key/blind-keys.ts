import { type WritingPromptOutput } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { type GradeWritingInput } from "../grade-essay/cases/shared";
import { type SourceQuestion } from "./source-questions";

export const BLIND_KEYS_FILE = "eval-results/blind-keys/keys.json";

/**
 * Production writes its own question with the key. A real question can only be keyed with one
 * rule more, appended to the production prompt in this eval alone.
 */
export const BLIND_KEY_INSTRUCTIONS = `## A question the board already set

This input also has \`givenQuestion\` and \`givenContext\`: a question the exam's board itself set for this task. Don't write a new question: copy \`givenQuestion\` into \`question\` and \`givenContext\` into \`context\` word for word, give it a \`title\`, and write the private key (\`criteria\`, \`aspects\`, \`keyPoints\`, \`sampleOutline\`, \`assessedSkillIds\`) for that question, under the rules that really govern it.`;

/** Production writes one key per question per learner pool, so each draw is a key a learner could get. */
export type BlindKey = {
  questionId: string;
  draw: number;
  model: string;
  promptVersion: string;
  productionPromptVersion: string;
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
      aspects: key.data.aspects,
      criteria: grading.criteria.map(({ id, points, text: name }) => ({ id, name, points })),
      grading,
      keySource: "practiceKey",
    },
    keyPoints: key.data.keyPoints,
    text,
  };
}
