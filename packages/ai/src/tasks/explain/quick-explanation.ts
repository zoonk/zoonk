import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions, chooseServiceTier } from "../../provider-options";
import { fitOptions } from "../_utils/fit-options";
import { formatLocalContext } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { imageRequestSchema } from "../images/image-request-schema";
import { MAX_CHECK_OPTIONS } from "../lesson-writer/written-lesson-schema";
import systemPrompt from "./quick-explanation.prompt.md";

/**
 * The first screen should show in about 20 seconds. Luna scored 8.68 and Terra 8.89 for eight times
 * the cost, so Terra is the fallback (30 Oct 2026). Since early November Luna's standard tier serves
 * about 95 tokens a second, 15s p50 and 23s p95 here; priority scored the same 8.3 to 8.5 in 9s p50
 * and 12s to 17s p95, at twice the price (11 Nov 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["openai/gpt-6.1-terra", "google/gemini-3.8-flash"] as const;

const MIN_OPTIONS = 2;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order; the story comes before the check and the ending. */
export const quickExplanationSchema = z.object({
  title: z.string(),
  description: z.string(),
  screens: z
    .array(z.object({ title: z.string(), text: z.string(), image: imageRequestSchema }))
    .min(1),
  check: z.object({
    question: z.string(),
    options: z
      .array(z.object({ text: z.string(), isCorrect: z.boolean(), feedback: z.string() }))
      .min(MIN_OPTIONS),
  }),
  recap: z.array(z.string()).min(1),
  goFurther: z.object({ overviewCourse: z.string(), relatedQuestions: z.array(z.string()) }),
});
/* oxlint-enable eslint/sort-keys */

export type QuickExplanation = z.infer<typeof quickExplanationSchema>;

export type QuickExplanationParams = {
  question: string;
  language: string;
  /** The country the content the question comes from is set in; null is the language's own. */
  country: string | null;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

export async function generateQuickExplanation({
  analytics,
  country,
  language,
  model = defaultModel,
  question,
  reasoning,
  useFallback = true,
}: QuickExplanationParams) {
  const userPrompt = `
    LANGUAGE: ${getPromptLanguageName({ language })}
${formatLocalContext({ country, language })}

${formatUntrustedInput({ QUESTION: question })}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    serviceTier: chooseServiceTier({ wait: "learner" }),
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: quickExplanationSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "quick-explanation",
  });

  const { check } = result.output;

  const data = {
    ...result.output,
    check: { ...check, options: fitOptions(check.options, MAX_CHECK_OPTIONS) },
  };

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
