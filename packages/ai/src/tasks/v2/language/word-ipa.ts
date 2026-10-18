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
 * In the word-ipa eval (83 words in 14 languages, 47 spelled like an English word or name, 32 with
 * both pronunciations in IPA; 11 Oct 2026) Claude Sonnet 5.5 caught every English spelling and
 * wrote every word's sounds, at 1.7s p50 and $0.88 per 1,000 words. What decides it is consistency:
 * a wrong IPA makes the voice and its check agree on a wrong word. Asked 5 times per look-alike,
 * Sonnet wrote all 115 right; Claude Haiku 5.5 (as fast, a tenth of the price) wrote Brazilian
 * "time" as a half-English ˈtajmi in 4 of 5, GPT-6 Luna cut it to ˈtʃĩ in 4 of 5, and Gemini 3.5
 * Flash Lite (0.9s) took 6 look-alikes for words of their own ("pane", "café"). GPT-6 Sol and
 * Gemini 3.8 Flash were as right at 2.6s to 3.1s. The decision models answer whether a word is an
 * English spelling in 0.35s but missed a quarter of the look-alikes (Jev 29 of 37, liquid-d1 27),
 * and catching them all took a threshold that flags about half of the other words.
 */
const defaultModel = "anthropic/claude-sonnet-5.5";
const fallbackModels = ["openai/gpt-6-sol", "google/gemini-3.8-flash"] as const;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the word's own sounds come before the English reading. */
const schema = z.object({ ipa: z.string(), englishIpa: z.string().nullable() });
/* oxlint-enable eslint/sort-keys */

const IPA_DELIMITERS = /[/[\]]/gu;

export type WordIpa = {
  /** How a native speaker says the word, in IPA; null when the model wrote nothing. */
  ipa: string | null;
  /** How English reads the same spelling when it's also an English word or name, else null. */
  englishIpa: string | null;
};

export type WordIpaParams = {
  word: string;
  /** The word's language: the lesson's target language. */
  language: string;
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

/** The sounds alone: no slashes or brackets around them, and nothing for an empty answer. */
function cleanIpa(ipa: string | null): string | null {
  return ipa?.replaceAll(IPA_DELIMITERS, "").trim() || null;
}

function buildUserPrompt({ language, word }: { language: string; word: string }): string {
  return `LANGUAGE: ${getPromptLanguageName({ language })}

${formatUntrustedInput({ WORD: word })}`;
}

/**
 * Writes how a word sounds in its language, in IPA, and how English reads the same spelling when
 * it's also an English word or name. Text-to-speech reads a word alone the English way when English
 * spells it the same ("Name" in German, "time" in Brazilian Portuguese), and the word's own IPA in
 * its instructions makes it say the word right.
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
