import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import {
  type PronouncedWord,
  splitExpectedWords,
  toPronouncedWords,
} from "./_utils/pronunciation-words";
import systemPrompt from "./assess-pronunciation.prompt.md";

/**
 * Only models that take audio in can run this, and on AI Gateway those are Gemini's: 3.8 Flash
 * matched 23 of 24 labeled clips with no false flags (28 Sep 2026). No other model backs it up (11
 * Oct 2026): the gateway already tries it on Vertex, and no other Gemini model is both different
 * and lasting.
 */
const defaultModel = "google/gemini-3.8-flash";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the model writes what it heard before judging each word. */
const schema = z.object({
  transcript: z.string(),
  words: z.array(
    z.object({
      number: z.number().int(),
      status: z.enum(["correct", "different", "missed"]),
      heard: z.string().nullable(),
      issue: z.enum(["sound", "stress"]).nullable(),
    }),
  ),
});
/* oxlint-enable eslint/sort-keys */

export type AssessPronunciationSchema = {
  /** "" when nobody spoke. */
  transcript: string;
  words: PronouncedWord[];
};

export type AssessPronunciationParams = {
  audio: Uint8Array;
  mediaType: string;
  expectedText: string;
  language: string;
  learnerLanguage?: string;
  model?: string;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt({
  expectedWords,
  expectedText,
  language,
  learnerLanguage,
}: {
  expectedWords: readonly string[];
  expectedText: string;
  language: string;
  learnerLanguage?: string;
}): string {
  const learnerLine = learnerLanguage
    ? `LEARNER_LANGUAGE: ${getPromptLanguageName({ language: learnerLanguage })}\n`
    : "";

  return `LANGUAGE: ${getPromptLanguageName({ language })}
${learnerLine}EXPECTED_SENTENCE: ${expectedText}
WORDS:
${expectedWords.map((word, index) => `${index + 1}. ${word}`).join("\n")}`;
}

/**
 * An accent a listener would understand passes. The model hears the audio itself, so it can judge
 * stress, which a transcript can't show. Nothing here stores the audio.
 */
export async function assessPronunciation({
  analytics,
  audio,
  expectedText,
  language,
  learnerLanguage,
  mediaType,
  model = defaultModel,
  reasoning,
}: AssessPronunciationParams) {
  const expectedWords = splitExpectedWords(expectedText);
  const userPrompt = buildUserPrompt({ expectedText, expectedWords, language, learnerLanguage });
  const providerOptions = buildProviderOptions({ fallbackModels: [], model, useFallback: false });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
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
        reasoning,
      }),
    systemPrompt,
    task: "assess-pronunciation",
  });

  const data: AssessPronunciationSchema = {
    transcript: result.output.transcript.trim(),
    words: toPronouncedWords({ expectedWords, verdicts: result.output.words }),
  };

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
