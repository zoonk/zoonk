import { z } from "zod";

const MIN_OBJECTIVES = 2;
const MAX_OBJECTIVES = 4;
const MIN_HINTS = 3;
const MAX_HINTS = 5;

/**
 * Each field names its language where the model writes it: with the languages only in the prompt,
 * Luna wrote objective descriptions and Gemini wrote roles in the language being learned.
 */
export function buildScenarioSchema({
  learnerLanguage,
  targetLanguage,
}: {
  learnerLanguage: string;
  targetLanguage: string;
}) {
  const inLearnerLanguage = `In ${learnerLanguage}`;
  const inTargetLanguage = `In ${targetLanguage}`;

  /* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the character's facts come before the lines and hints that use them. */
  return z.object({
    title: z.string().describe(inLearnerLanguage),
    situation: z.string().describe(inLearnerLanguage),
    character: z.object({
      name: z.string(),
      role: z.string().describe(inLearnerLanguage),
      place: z.string().describe(inTargetLanguage),
    }),
    characterBrief: z.string(),
    objectives: z
      .array(
        z.object({
          label: z.string().describe(inTargetLanguage),
          description: z.string().describe(inLearnerLanguage),
        }),
      )
      .min(MIN_OBJECTIVES)
      .max(MAX_OBJECTIVES),
    openingLine: z.string().describe(inTargetLanguage),
    hints: z.array(z.string().describe(inTargetLanguage)).min(MIN_HINTS).max(MAX_HINTS),
  });
  /* oxlint-enable eslint/sort-keys */
}

export type ScenarioSchema = z.infer<ReturnType<typeof buildScenarioSchema>>;
