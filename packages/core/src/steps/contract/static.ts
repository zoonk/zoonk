import { z } from "zod";
import { staticStoryIntroContentSchema, staticStoryOutcomeContentSchema } from "./story";

const staticTextContentSchema = z
  .object({
    text: z.string(),
    title: z.string(),
    variant: z.literal("text"),
  })
  .strict();

const staticGrammarExampleContentSchema = z
  .object({
    highlight: z.string(),
    romanization: z.string().min(1).nullable(),
    sentence: z.string(),
    translation: z.string(),
    variant: z.literal("grammarExample"),
  })
  .strict();

const staticGrammarRuleContentSchema = z
  .object({
    ruleName: z.string(),
    ruleSummary: z.string(),
    variant: z.literal("grammarRule"),
  })
  .strict();

export const staticContentSchema = z.discriminatedUnion("variant", [
  staticTextContentSchema,
  staticGrammarExampleContentSchema,
  staticGrammarRuleContentSchema,
  staticStoryIntroContentSchema,
  staticStoryOutcomeContentSchema,
]);

export type StaticStepContent = z.infer<typeof staticContentSchema>;
