import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import {
  QUICK_EXPLANATION_MAX_SCREENS,
  QUICK_EXPLANATION_MIN_SCREENS,
} from "./quick-explanation-checks";
import systemPrompt from "./quick-explanation.prompt.md";

/**
 * The first screen should show in about 20 seconds. In the eval (6 cases,
 * Sep 2026) Luna scored 8.73 at 8.6s p50, Sol 9.12 but at 21s p50, and
 * Gemini 3.8 Flash 7.88 with accuracy problems on every case.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["openai/gpt-6-sol", "google/gemini-3.8-flash"] as const;

const RECAP_ITEMS = 3;
const MIN_CHECK_OPTIONS = 3;
const MAX_CHECK_OPTIONS = 4;
const MAX_RELATED_QUESTIONS = 3;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order; the story comes before the check and the ending. */
const schema = z.object({
  title: z.string(),
  screens: z
    .array(z.object({ title: z.string(), text: z.string(), imagePrompt: z.string().nullable() }))
    .min(QUICK_EXPLANATION_MIN_SCREENS)
    .max(QUICK_EXPLANATION_MAX_SCREENS),
  check: z.object({
    question: z.string(),
    options: z
      .array(z.object({ text: z.string(), isCorrect: z.boolean(), feedback: z.string() }))
      .min(MIN_CHECK_OPTIONS)
      .max(MAX_CHECK_OPTIONS),
  }),
  recap: z.array(z.string()).length(RECAP_ITEMS),
  goFurther: z.object({
    overviewCourse: z.string(),
    relatedQuestions: z.array(z.string()).min(2).max(MAX_RELATED_QUESTIONS),
  }),
});
/* oxlint-enable eslint/sort-keys */

export type QuickExplanation = z.infer<typeof schema>;

export type QuickExplanationParams = {
  question: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * Answers a "how does it work" or "what is" question as a quick explanation:
 * 4 to 6 short screens with one idea each, a practical example, one check and
 * the "Now you know" recap with a "Want to go further?" hint into the subject's
 * overview course. Learners wait for it, so it runs on a fast model.
 */
export async function generateQuickExplanation({
  analytics,
  language,
  model = defaultModel,
  question,
  reasoning,
  useFallback = true,
}: QuickExplanationParams) {
  const userPrompt = `
    LANGUAGE: ${getPromptLanguageName({ language })}
${formatLocalContext(language)}

${formatUntrustedInput({ QUESTION: question })}
  `;

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "quick-explanation",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
