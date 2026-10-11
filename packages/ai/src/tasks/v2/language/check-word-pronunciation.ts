import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { isCloserToNative } from "./_utils/ipa-similarity";
import systemPrompt from "./check-word-pronunciation.prompt.md";

/**
 * Only models that take audio in can listen, and on AI Gateway those are Gemini's. In the
 * check-word-pronunciation eval (8 words English spells the same, each voiced as English and in
 * its language; 11 Oct 2026) it got all 16 right at 2.9s p50; one call took 43s.
 */
const defaultModel = "google/gemini-3.8-flash";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the model writes what it heard before choosing. */
const schema = z.object({
  heard: z.string(),
  pronunciation: z.enum(["native", "english", "unclear"]),
});
/* oxlint-enable eslint/sort-keys */

export type WordPronunciationCheck = z.infer<typeof schema> & {
  /** Called native, and what it heard is closer to the word's IPA than to the English reading. */
  soundsNative: boolean;
};

export type CheckWordPronunciationParams = {
  audio: Uint8Array;
  /** "audio/mpeg", "audio/wav"... */
  mediaType: string;
  word: string;
  /** The word's language: the lesson's target language. */
  language: string;
  /** How the word sounds in its language, in IPA. */
  ipa: string;
  /** How English reads the same spelling, in IPA. */
  englishIpa: string;
  analytics?: AiGenerationContext;
  abortSignal?: AbortSignal;
  model?: string;
};

function buildUserPrompt({
  englishIpa,
  ipa,
  language,
  word,
}: Pick<CheckWordPronunciationParams, "englishIpa" | "ipa" | "language" | "word">): string {
  return `LANGUAGE: ${getPromptLanguageName({ language })}
NATIVE: /${ipa}/
ENGLISH: /${englishIpa}/

${formatUntrustedInput({ WORD: word })}`;
}

/**
 * Listens to a clip of a word English spells the same and tells whether it was read with the
 * sounds of its language or the English ones, given both in IPA: a transcript writes the same
 * spelling either way. A voice that reads "Name" in a German lesson as the English "name" teaches
 * the wrong word, so such a clip is voiced again. The model let a half-English reading through as
 * native with an accent ("time" heard as ˈtaɪmi in Brazilian Portuguese), so a clip only sounds
 * native when what it heard is also closer to the word's IPA than to the English one.
 */
export async function checkWordPronunciation({
  abortSignal,
  analytics,
  audio,
  englishIpa,
  ipa,
  language,
  mediaType,
  model = defaultModel,
  word,
}: CheckWordPronunciationParams) {
  const userPrompt = buildUserPrompt({ englishIpa, ipa, language, word });
  const providerOptions = buildProviderOptions({ fallbackModels: [], model, useFallback: false });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        abortSignal,
        instructions: systemPrompt,
        messages: [
          {
            content: [
              { text: userPrompt, type: "text" },
              { data: audio, mediaType, type: "file" },
            ],
            role: "user",
          },
        ],
        model,
        output: Output.object({ schema }),
        providerOptions,
      }),
    // A lesson's word, and the app's own clip of it, are Library content.
    libraryInput: true,
    systemPrompt,
    task: "check-word-pronunciation",
  });

  const heard = result.output.heard.replaceAll(/[/[\]]/gu, "").trim();
  const { pronunciation } = result.output;

  const data: WordPronunciationCheck = {
    heard,
    pronunciation,
    soundsNative: pronunciation === "native" && isCloserToNative({ englishIpa, heard, ipa }),
  };

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
