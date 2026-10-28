import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { toPassMarkTranslations } from "./pass-mark-translations";
import systemPrompt from "./translate-pass-marks.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

const schema = z.object({
  language: z.string(),
  translations: z.array(z.object({ language: z.string(), texts: z.array(z.string()) })),
});

export type TranslatePassMarksParams = {
  texts: string[];
  /** The texts' own language is skipped. */
  languages: readonly string[];
  model?: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

export type PassMarkTranslations = { language: string; translations: Record<string, string[]> };

/**
 * A shared reading serves every learner of the exam, so it runs once per reading. Code keeps only
 * translations with a line per pass mark and every number of it.
 */
export async function translatePassMarks({
  analytics,
  languages,
  model = defaultModel,
  reasoning,
  serviceTier,
  texts,
  useFallback = true,
}: TranslatePassMarksParams) {
  const userPrompt = formatUntrustedInput({
    LANGUAGES: languages
      .map((language) => `${language}: ${getPromptLanguageName({ language })}`)
      .join("\n"),
    TEXTS: texts.join("\n"),
  });

  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

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
    libraryInput: true,
    systemPrompt,
    task: "translate-pass-marks",
  });

  const data: PassMarkTranslations = {
    language: result.output.language,
    translations: toPassMarkTranslations({ languages, output: result.output, texts }),
  };

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
