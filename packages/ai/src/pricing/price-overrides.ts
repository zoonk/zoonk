import { type ModelPricing } from "./gateway-prices";

const SECONDS_PER_MINUTE = 60;
const TOKENS_PER_MILLION = 1_000_000;

/**
 * Google bills speech by audio tokens (pricing page, checked 6 Oct 2026), but the AI SDK reports
 * speech in seconds of audio.
 */
const GEMINI_AUDIO_TOKENS_PER_SECOND = 25;

/** Dollars per million tokens. */
type GeminiSpeechPrice = { audio: number; text: number };

function geminiSpeech({ audio, text }: GeminiSpeechPrice): ModelPricing {
  return {
    input: text / TOKENS_PER_MILLION,
    output: 0,
    perSecond: (audio / TOKENS_PER_MILLION) * GEMINI_AUDIO_TOKENS_PER_SECOND,
  };
}

const OPENAI_TRANSCRIPTION_USD_PER_MINUTE = 0.0045;

function perMinute(usd: number): ModelPricing {
  return { input: 0, output: 0, perSecond: usd / SECONDS_PER_MINUTE };
}

/** AI Gateway's price on 11 Oct 2026. */
const MAI_VOICE_FLASH_USD_PER_MILLION_CHARACTERS = 15;

function perMillionCharacters(usd: number): ModelPricing {
  return { input: 0, output: 0, perCharacter: usd / TOKENS_PER_MILLION };
}

/** Models the gateway's list doesn't price, from the providers' pricing pages (6 Oct 2026). */
export const PRICE_OVERRIDES: Readonly<Record<string, ModelPricing>> = {
  "google/gemini-2.5-flash-preview-tts": geminiSpeech({ audio: 10, text: 0.5 }),
  "google/gemini-3.8-flash-lite-tts": geminiSpeech({ audio: 6, text: 0.5 }),
  "google/gemini-3.8-flash-tts": geminiSpeech({ audio: 9, text: 0.5 }),
  "microsoft/mai-voice-2.1-flash": perMillionCharacters(MAI_VOICE_FLASH_USD_PER_MILLION_CHARACTERS),
  "openai/gpt-transcribe": perMinute(OPENAI_TRANSCRIPTION_USD_PER_MINUTE),
};

function perMillionTokens({
  cacheRead,
  input,
  output,
}: {
  cacheRead: number;
  input: number;
  output: number;
}): { input: number; inputCacheRead: number; output: number } {
  return {
    input: input / TOKENS_PER_MILLION,
    inputCacheRead: cacheRead / TOKENS_PER_MILLION,
    output: output / TOKENS_PER_MILLION,
  };
}

/** From `from` (UTC), it replaces the current price. */
type PriceChange = { from: string; model: string; pricing: ModelPricing };

/** Announced on the providers' pricing pages (checked 6 Oct 2026). */
export const PRICE_CHANGES: readonly PriceChange[] = [
  // Gemini 4 Argon's launch price ends on 30 November 2026 and every rate doubles (Google's
  // pricing page, checked 13 Oct 2026).
  {
    from: "2026-12-01T00:00:00Z",
    model: "google/gemini-4-argon",
    pricing: {
      ...perMillionTokens({ cacheRead: 0.2, input: 4, output: 20 }),
      serviceTiers: {
        flex: perMillionTokens({ cacheRead: 0.1, input: 2, output: 10 }),
        priority: perMillionTokens({ cacheRead: 0.36, input: 7.2, output: 36 }),
      },
    },
  },
  // Google doubles its speech prices on 1 January 2027.
  {
    from: "2027-01-01T00:00:00Z",
    model: "google/gemini-3.8-flash-lite-tts",
    pricing: geminiSpeech({ audio: 12, text: 1 }),
  },
  {
    from: "2027-01-01T00:00:00Z",
    model: "google/gemini-3.8-flash-tts",
    pricing: geminiSpeech({ audio: 18, text: 1 }),
  },
];
