import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./word-ipa.prompt.md";

/**
 * A wrong IPA makes the voice and its check agree on a wrong word. Claude Sonnet 5.5 wrote all 115
 * look-alike readings right on the word-ipa eval; Haiku, Luna and Flash Lite got some wrong (11 Oct
 * 2026).
 */
const defaultModel = "anthropic/claude-sonnet-5.5";
const fallbackModels = ["openai/gpt-6-sol", "google/gemini-3.8-flash"] as const;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the word's own sounds come before the English reading. */
const schema = z.object({ ipa: z.string(), englishIpa: z.string().nullable() });
/* oxlint-enable eslint/sort-keys */

const IPA_DELIMITERS = /[/[\]]/gu;

export type WordIpa = {
  /** Null when the model wrote nothing. */
  ipa: string | null;
  /** Null unless the spelling is also an English word or name. */
  englishIpa: string | null;
};

export type WordIpaParams = {
  word: string;
  language: string;
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

function cleanIpa(ipa: string | null): string | null {
  return ipa?.replaceAll(IPA_DELIMITERS, "").trim() || null;
}

function buildUserPrompt({ language, word }: { language: string; word: string }): string {
  return `LANGUAGE: ${getPromptLanguageName({ language })}

${formatUntrustedInput({ WORD: word })}`;
}

/**
 * Text-to-speech reads a word alone the English way when English spells it the same; the word's own
 * IPA in its instructions makes it say the word right.
 */
export async function writeWordIpa({
  analytics,
  language,
  model = defaultModel,
  reasoning,
  useFallback = true,
  word,
}: WordIpaParams) {
  const userPrompt = buildUserPrompt({ language, word });
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
    // A lesson's word, and the app's own clip of it, are Library content.
    libraryInput: true,
    systemPrompt,
    task: "word-ipa",
  });

  const data: WordIpa = {
    englishIpa: cleanIpa(result.output.englishIpa),
    ipa: cleanIpa(result.output.ipa),
  };

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
