import "server-only";
import { setTimeout } from "node:timers/promises";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type TTSVoice, getLanguageName } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import promptTemplate from "./generate-language-audio.prompt.md";
import { generateWithGemini } from "./provider-gemini";
import { generateWithOpenAI } from "./provider-openai";

const DEFAULT_VOICE: TTSVoice = "Kore";
const MAX_ATTEMPTS_PER_PROVIDER = 3;
const INITIAL_BACKOFF_MS = 1000;

export type AudioFormat = "opus" | "wav";

export type AudioResult = {
  audio: Uint8Array;
  format: AudioFormat;
};

type AudioProvider = (params: {
  instructions: string;
  text: string;
  voice: TTSVoice;
}) => Promise<AudioResult>;

type ScheduledAttempt = {
  backoffMs: number;
  generate: AudioProvider;
  name: string;
};

function buildInstructions(languageCode?: string): string {
  const languageName = languageCode
    ? getLanguageName({ targetLanguage: languageCode, userLanguage: "en" })
    : "English";

  return promptTemplate.replaceAll("{{LANGUAGE}}", () => languageName);
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
function buildAttemptSchedule(
  providers: readonly { generate: AudioProvider; name: string }[],
): ScheduledAttempt[] {
  return Array.from({ length: MAX_ATTEMPTS_PER_PROVIDER }, (_, round) =>
    providers.map((provider) => ({
      backoffMs: round === 0 ? 0 : INITIAL_BACKOFF_MS * 2 ** (round - 1),
      generate: provider.generate,
      name: provider.name,
    })),
  ).flat();
}

/**
 * Tries each provider in alternating order with per-provider
 * exponential backoff. Switching providers immediately after a
 * failure avoids waiting when a different provider might succeed
 * right away. Backoff only applies when retrying the same provider.
 */
async function generateWithFallback({
  instructions,
  text,
  voice,
}: {
  instructions: string;
  text: string;
  voice: TTSVoice;
}): Promise<AudioResult> {
  const schedule = buildAttemptSchedule([
    { generate: generateWithGemini, name: "gemini" },
    { generate: generateWithOpenAI, name: "openai" },
  ]);

  let lastError: Error | undefined;

  /* oxlint-disable no-await-in-loop -- Sequential retry with backoff is intentional.
   * We must wait for each attempt to fail before trying the next provider. */
  for (const attempt of schedule) {
    if (attempt.backoffMs > 0) {
      await setTimeout(attempt.backoffMs);
    }

    try {
      return await attempt.generate({ instructions, text, voice });
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
  text,
  voice = DEFAULT_VOICE,
}: {
  language?: string;
  text: string;
  voice?: TTSVoice;
}): Promise<SafeReturn<AudioResult>> {
  const instructions = buildInstructions(language);

  return safeAsync(() => generateWithFallback({ instructions, text, voice }));
}
