import { z } from "zod";
import { stepImageSchema } from "./image";

/**
 * Static steps are the readable teaching surface for explanation and custom
 * activities. They can optionally carry a generated illustration so the player
 * can render text and image together inside one step instead of splitting them
 * across separate rows.
 */
function withOptionalImage<TSchema extends z.ZodRawShape>(shape: TSchema) {
  return z.object({ ...shape, image: stepImageSchema.optional() }).strict();
}

const staticTextContentSchema = withOptionalImage({
  text: z.string(),
  title: z.string(),
  variant: z.literal("text"),
});

const staticIntroContentSchema = withOptionalImage({
  text: z.string(),
  title: z.string(),
  variant: z.literal("intro"),
});

const staticGrammarExampleContentSchema = withOptionalImage({
  highlight: z.string(),
  romanization: z.string().min(1).nullable(),
  sentence: z.string(),
  translation: z.string(),
  variant: z.literal("grammarExample"),
});

const staticGrammarRuleContentSchema = withOptionalImage({
  ruleName: z.string(),
  ruleSummary: z.string(),
  variant: z.literal("grammarRule"),
});

export const staticContentSchema = z.discriminatedUnion("variant", [
  staticIntroContentSchema,
  staticTextContentSchema,
  staticGrammarExampleContentSchema,
  staticGrammarRuleContentSchema,
]);

export type StaticStepContent = z.infer<typeof staticContentSchema>;
