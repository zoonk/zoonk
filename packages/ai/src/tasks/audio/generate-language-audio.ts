import "server-only";
import { setTimeout } from "node:timers/promises";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type TTSVoice } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { type SpeechModel, generateSpeech } from "ai";
import { getPromptLanguageName } from "../_utils/prompt-language";
import alphabetSymbolPrompt from "./generate-language-audio-alphabet-symbol.prompt.md";
import promptTemplate from "./generate-language-audio.prompt.md";
import { LANGUAGE_AUDIO_MODELS, type LanguageAudioModel } from "./language-audio-models";

export type { LanguageAudioModel } from "./language-audio-models";

const DEFAULT_VOICE: TTSVoice = "Kore";
const MAX_ATTEMPTS_PER_PROVIDER = 3;
const INITIAL_BACKOFF_MS = 1000;
const OPENAI_FALLBACK_VOICE = "marin";

const READ_ALOUD_TEMPLATE =
  "The following text is {{LANGUAGE}}. Speak clearly at a moderate pace suitable for language learners. Enunciate each word precisely; read it aloud in {{LANGUAGE}}.";

type AudioFormat = "opus" | "wav";
type AudioProviderName = "gemini" | "openai";

export type AudioResult = { audio: Uint8Array; format: AudioFormat };
export type LanguageAudioUsage = "alphabetSymbol";

const usagePrompts = { alphabetSymbol: alphabetSymbolPrompt } satisfies Record<
  LanguageAudioUsage,
  string
>;

type AudioProviderConfig = {
  id: LanguageAudioModel;
  format: AudioFormat;
  model: SpeechModel;
  name: AudioProviderName;
  voice?: string;
};

type ScheduledAttempt = { backoffMs: number; provider: AudioProviderConfig };

/* oxlint-disable-next-line no-magic-numbers -- 850 KiB is the prompt-leak failure threshold observed in generated audio files. */
const MAX_AUDIO_BYTES = 850 * 1024;

const [geminiAudioModel, openAIAudioModel] = LANGUAGE_AUDIO_MODELS;

const audioProviders = [
  {
    format: "wav",
    id: geminiAudioModel.id,
    model: google.speech(geminiAudioModel.model),
    name: "gemini",
  },
  {
    format: "opus",
    id: openAIAudioModel.id,
    model: openai.speech(openAIAudioModel.model),
    name: "openai",
    voice: OPENAI_FALLBACK_VOICE,
  },
] satisfies readonly AudioProviderConfig[];

/**
 * Rejects generated audio that is too long to be a normal word or learner
 * sentence. The original failure was seen with Gemini reading prompt
 * instructions, but an oversized file is invalid for this task regardless of
 * which provider returned it.
 */
function assertExpectedAudioSize({
  audio,
  provider,
}: {
  audio: Uint8Array;
  provider: AudioProviderName;
}) {
  if (audio.byteLength <= MAX_AUDIO_BYTES) {
    return;
  }

  throw new Error(
    `${provider} TTS returned oversized audio: ${audio.byteLength} bytes. Expected at most ${MAX_AUDIO_BYTES} bytes.`,
  );
}

/**
 * Runs every speech provider through the same AI SDK call so provider-specific
 * differences stay in configuration: model, output format, and fallback voice.
 */
async function generateWithProvider({
  instructions,
  provider,
  text,
  voice,
}: {
  instructions?: string;
  provider: AudioProviderConfig;
  text: string;
  voice: TTSVoice;
}): Promise<AudioResult> {
  const { audio } = await generateSpeech({
    ...(instructions ? { instructions } : {}),
    model: provider.model,
    outputFormat: provider.format,
    text,
    voice: provider.voice ?? voice,
  });

  const audioBytes = audio.uint8Array;

  assertExpectedAudioSize({ audio: audioBytes, provider: provider.name });
  return { audio: audioBytes, format: provider.format };
}

/**
 * Skips prompt guidance for normal English word and sentence audio because the
 * extra instructions exist to prevent non-English words from being read with
 * English pronunciation. Usage-specific audio, such as alphabet symbols, still
 * gets guidance because the text may not be a normal word.
 */
function shouldBuildInstructions({
  language,
  usage,
}: {
  language?: string;
  usage?: LanguageAudioUsage;
}) {
  return Boolean(usage) || Boolean(language && language !== "en");
}

/**
 * Expands the TTS prompt with optional usage-specific instructions. Keeping the
 * usage structured avoids passing learner-facing romanization or pronunciation
 * hints into the audio model, which can make output less stable.
 */
function buildInstructions({
  language,
  usage,
}: {
  language?: string;
  usage?: LanguageAudioUsage;
}): string | undefined {
  if (!shouldBuildInstructions({ language, usage })) {
    return undefined;
  }

  const languageName = language
    ? getPromptLanguageName({ language })
    : getPromptLanguageName({ language: "en" });

  const languagePrompt =
    language && language !== "en"
      ? promptTemplate.replaceAll("{{LANGUAGE}}", () => languageName)
      : "";

  const usagePrompt = usage ? usagePrompts[usage] : "";
  const readAloudPrompt = READ_ALOUD_TEMPLATE.replaceAll("{{LANGUAGE}}", () => languageName);

  return [languagePrompt, usagePrompt, readAloudPrompt].filter(Boolean).join("\n\n");
}

/**
 * Builds a flat list of retry attempts that alternates between
 * providers with per-provider exponential backoff.
 *
 * Example with 2 providers and 3 attempts each:
 *   Gemini (0ms) → OpenAI (0ms) → Gemini (1s) → OpenAI (1s) → Gemini (2s) → OpenAI (2s)
 *
 * First attempt per provider has no delay. Subsequent retries of the
 * same provider use exponential backoff (1s, 2s, 4s, ...).
 */
function buildAttemptSchedule(providers: readonly AudioProviderConfig[]): ScheduledAttempt[] {
  return Array.from({ length: MAX_ATTEMPTS_PER_PROVIDER }, (_, round) =>
    providers.map((provider) => ({
      backoffMs: round === 0 ? 0 : INITIAL_BACKOFF_MS * 2 ** (round - 1),
      provider,
    })),
  ).flat();
}

/**
 * Uses the full fallback chain for production audio, but lets diagnostic tools
 * pin generation to one model so provider-specific failures are visible.
 */
function getAttemptProviders({ model }: { model?: LanguageAudioModel }) {
  if (!model) {
    return audioProviders;
  }

  return audioProviders.filter((provider) => provider.id === model);
}

/**
 * Tries each provider in alternating order with per-provider
 * exponential backoff. Switching providers immediately after a
 * failure avoids waiting when a different provider might succeed
 * right away. Backoff only applies when retrying the same provider.
 */
async function generateWithFallback({
  instructions,
  model,
  text,
  voice,
}: {
  instructions?: string;
  model?: LanguageAudioModel;
  text: string;
  voice: TTSVoice;
}): Promise<AudioResult> {
  const schedule = buildAttemptSchedule(getAttemptProviders({ model }));

  let lastError: Error | undefined;

  /* oxlint-disable no-await-in-loop -- Sequential retry with backoff is intentional.
   * We must wait for each attempt to fail before trying the next provider. */
  for (const attempt of schedule) {
    if (attempt.backoffMs > 0) {
      await setTimeout(attempt.backoffMs);
    }

    try {
      return await generateWithProvider({
        ...(instructions ? { instructions } : {}),
        provider: attempt.provider,
        text,
        voice,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  /* oxlint-enable no-await-in-loop */

  logError("All TTS providers failed after retries:", lastError);
  throw lastError ?? new Error("All TTS providers failed");
}

/**
 * Generates audio for the given text using Gemini TTS as the primary
 * provider and OpenAI TTS as a fallback. Alternates between providers
 * on failure with exponential backoff to handle rate limits.
 */
export async function generateLanguageAudio({
  language,
  model,
  text,
  usage,
  voice = DEFAULT_VOICE,
}: {
  language?: string;
  model?: LanguageAudioModel;
  text: string;
  usage?: LanguageAudioUsage;
  voice?: TTSVoice;
}): Promise<SafeReturn<AudioResult>> {
  const instructions = buildInstructions({ language, usage });

  return safeAsync(() =>
    generateWithFallback({
      ...(instructions ? { instructions } : {}),
      ...(model ? { model } : {}),
      text,
      voice,
    }),
  );
}
