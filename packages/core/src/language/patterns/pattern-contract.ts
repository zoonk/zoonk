import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";

const MAX_DRILL_QUESTIONS = 10;
const MAX_DRILL_ANSWER_LENGTH = 200;

/** What a stored pattern keeps as text: the rule, contrasts, the mistakes it read and the drill. */
export const mistakePatternContentSchema = z.object({
  contrast: z.array(z.object({ example: z.string(), label: z.string() })),
  drill: z.array(
    z.object({
      answer: z.string(),
      feedback: z.string(),
      options: z.array(z.string()),
      sentence: z.string(),
    }),
  ),
  examples: z.array(
    z.object({ answer: z.string(), correctAnswer: z.string(), format: z.string() }),
  ),
  rule: z.string(),
});

export const mistakePatternViewSchema = mistakePatternContentSchema
  .extend({
    id: z.uuid(),
    kind: z.enum(["pattern", "typos"]),
    occurrences: z
      .int()
      .min(0)
      .meta({ description: "How many of the recent mistakes it read show it" }),
    practiced: z.boolean(),
    title: z.string(),
  })
  .meta({ id: "MistakePattern" });

export type MistakePatternView = z.infer<typeof mistakePatternViewSchema>;

export const mistakePatternPracticeInputSchema = z
  .object({
    answers: z
      .array(z.string().max(MAX_DRILL_ANSWER_LENGTH))
      .max(MAX_DRILL_QUESTIONS)
      .meta({ description: "The option chosen for each drill question, in order" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "MistakePatternPracticeInput" });

export type MistakePatternPracticeInput = z.infer<typeof mistakePatternPracticeInputSchema>;

export const mistakePatternPracticeResultSchema = z
  .object({ brainPower: z.int().min(0), correct: z.int().min(0), total: z.int().min(0) })
  .meta({ id: "MistakePatternPracticeResult" });
