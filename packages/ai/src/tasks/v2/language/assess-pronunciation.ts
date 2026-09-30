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
 * Only models that take audio in can run this, and on AI Gateway those are
 * Gemini's. The check flags what a native listener wouldn't understand as the
 * word written (another word or form, or a word they couldn't make out), never
 * an accent. In the eval (24 labeled text-to-speech clips in English,
 * Portuguese and Spanish, sentences and single words, 11 with such a mistake;
 * 28 Sep 2026) Gemini 3.8 Flash matched 23 with no false flags, missing only
 * "hent" for "rent" inside a sentence, at 3.9s p50 and $3.51 per 1,000
 * answers. Gemini 3.5 Flash caught all 11 but flagged 3 stress slips a
 * listener would understand ("Can we order desert?"), at 4.7s and $8.05. The
 * earlier prompt, which flagged every audible slip, matched 13 of the first 21
 * with 3.5 Flash. Transcription with a word diff (gpt-transcribe, the fallback
 * when this task fails) matched 22 at 0.8s: it lets through a wrong form
 * ("estar" for "está") and flags an extra vowel ("bookie" for "book"). The
 * clips test clear slips, not real accents, so real recordings should confirm
 * this.
 *
 * Azure Pronunciation Assessment is the specialist option, not measured here
 * (no credentials). Its short-audio REST endpoint
 * (`https://<resource>.cognitiveservices.azure.com/stt/speech/recognition/conversation/cognitiveservices/v1?language=<locale>`)
 * takes up to 30 seconds of 16 kHz WAV or OGG Opus (so browser WebM or MP4 needs
 * converting) with a base64 JSON `Pronunciation-Assessment` header
 * (`ReferenceText`, `Granularity`, `Dimension: "Comprehensive"`, `EnableMiscue`)
 * and returns accuracy scores and an `ErrorType` per word (Mispronunciation,
 * Omission, Insertion); prosody, which covers stress, is en-US only. Its locales
 * include en-US, pt-BR and es-ES. It costs the same as speech to text, and
 * Microsoft would become a new processor of learners' voices. It scores how
 * native a word sounds, so it would need thresholds to judge being understood.
 */
const defaultModel = "google/gemini-3.8-flash";
const fallbackModels = ["google/gemini-3.5-flash"] as const;

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
  /** What the model heard, mistakes included; "" when nobody spoke. */
  transcript: string;
  /** Every word of the expected sentence, in order, as written. */
  words: PronouncedWord[];
};

export type AssessPronunciationParams = {
  audio: Uint8Array;
  /** "audio/webm", "audio/mp4", "audio/mpeg"... */
  mediaType: string;
  expectedText: string;
  /** The language spoken: the step's target language. */
  language: string;
  learnerLanguage?: string;
  model?: string;
  useFallback?: boolean;
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
 * Listens to a learner saying a sentence and judges each word against it:
 * understood as written, understood as another word or form (with what it
 * sounded like and whether a sound or the stress made the difference) or not
 * said. An accent a listener would understand passes. The audio goes to the
 * model with the expected sentence, so it can hear stress, which a transcript
 * can't show. Nothing here stores the audio.
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
  useFallback = true,
}: AssessPronunciationParams) {
  const expectedWords = splitExpectedWords(expectedText);
  const userPrompt = buildUserPrompt({ expectedText, expectedWords, language, learnerLanguage });
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

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
