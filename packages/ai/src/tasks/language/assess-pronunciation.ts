import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import regionalFormsPrompt from "../_utils/regional-forms.prompt.md";
import {
  type PronouncedWord,
  splitExpectedWords,
  toPronouncedWords,
} from "./_utils/pronunciation-words";
import taskPrompt from "./assess-pronunciation.prompt.md";

const systemPrompt = `${taskPrompt}\n${regionalFormsPrompt}`;

/**
 * No fallback: other providers' audio models on AI Gateway take only MP3 or WAV, not the WebM and
 * MP4 learners record. Gemini 4 Hydrogen was right on 83.3% of 90 runs to Flash's 95.6% (18 Nov
 * 2026) and wrongly rejected 14 of 48 good clips (Flash 2), at $10.09/1k against $3.54/1k.
 */
const defaultModel = "google/gemini-3.8-flash";

/**
 * With the transcript as a second listener's guess, low reasoning judged 54 of 54 recordings whose
 * transcript differed from the sentence and 32 of 34 labeled clips (25 Nov 2026); the default
 * reasoning without it judged 52 and 27, at twice the cost and wait (p50 9.7 s against 4.9 s).
 */
const defaultReasoning: Reasoning = "low";

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
  romanization?: string | null;
  transcriberHeard?: string;
  model?: string;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt({
  expectedWords,
  expectedText,
  language,
  learnerLanguage,
  romanization,
  transcriberHeard,
}: {
  expectedWords: readonly string[];
  expectedText: string;
  language: string;
  learnerLanguage?: string;
  romanization?: string | null;
  transcriberHeard?: string;
}): string {
  const learnerLine = learnerLanguage
    ? `LEARNER_LANGUAGE: ${getPromptLanguageName({ language: learnerLanguage })}\n`
    : "";

  const reading = romanization ? `\nEXPECTED_PRONUNCIATION: ${romanization}` : "";
  const transcriber = transcriberHeard ? `\nTRANSCRIBER_HEARD: ${transcriberHeard}` : "";

  return `LANGUAGE: ${getPromptLanguageName({ language })}
${learnerLine}EXPECTED_SENTENCE: ${expectedText}${reading}${transcriber}
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
  romanization,
  reasoning = defaultReasoning,
  transcriberHeard,
}: AssessPronunciationParams) {
  const expectedWords = splitExpectedWords(expectedText);

  const userPrompt = buildUserPrompt({
    expectedText,
    expectedWords,
    language,
    learnerLanguage,
    romanization,
    transcriberHeard,
  });

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
