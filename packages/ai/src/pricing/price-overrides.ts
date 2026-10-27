import { type ModelPricing } from "./gateway-prices";

const SECONDS_PER_MINUTE = 60;
const TOKENS_PER_MILLION = 1_000_000;

/**
 * Google bills speech by audio tokens, 25 for every second of audio (pricing page, checked 6 Oct
 * 2026), so its per-token audio price becomes a per-second one: the AI SDK reports speech in
 * seconds of audio, not tokens.
 */
const GEMINI_AUDIO_TOKENS_PER_SECOND = 25;

/** Dollars per million tokens of a Google speech model: the text it reads and the audio out. */
type GeminiSpeechPrice = { audio: number; text: number };

function geminiSpeech({ audio, text }: GeminiSpeechPrice): ModelPricing {
  return {
    input: text / TOKENS_PER_MILLION,
    output: 0,
    perSecond: (audio / TOKENS_PER_MILLION) * GEMINI_AUDIO_TOKENS_PER_SECOND,
  };
}

/** Dollars per minute of audio gpt-transcribe hears. */
const OPENAI_TRANSCRIPTION_USD_PER_MINUTE = 0.0045;

function perMinute(usd: number): ModelPricing {
  return { input: 0, output: 0, perSecond: usd / SECONDS_PER_MINUTE };
}

/** MAI-Voice-2.1 Flash bills the characters it reads: AI Gateway's dollars per million (11 Oct 2026). */
const MAI_VOICE_FLASH_USD_PER_MILLION_CHARACTERS = 15;

function perMillionCharacters(usd: number): ModelPricing {
  return { input: 0, output: 0, perCharacter: usd / TOKENS_PER_MILLION };
}

/**
 * Models we call that the gateway's list doesn't price, from the providers' pricing pages
 * (checked 6 Oct 2026): Google's speech models, priced by the text they read and their audio
 * tokens, and gpt-transcribe, $0.0045 a minute, which goes to OpenAI directly. Since 11 Oct 2026:
 * MAI-Voice-2.1 Flash, per character (AI Gateway's price).
 */
export const PRICE_OVERRIDES: Readonly<Record<string, ModelPricing>> = {
  "google/gemini-2.5-flash-preview-tts": geminiSpeech({ audio: 10, text: 0.5 }),
  "google/gemini-3.8-flash-lite-tts": geminiSpeech({ audio: 6, text: 0.5 }),
  "google/gemini-3.8-flash-tts": geminiSpeech({ audio: 9, text: 0.5 }),
  "microsoft/mai-voice-2.1-flash": perMillionCharacters(MAI_VOICE_FLASH_USD_PER_MILLION_CHARACTERS),
  "openai/gpt-transcribe": perMinute(OPENAI_TRANSCRIPTION_USD_PER_MINUTE),
};

/** Token rates from a pricing page's dollars per million tokens. */
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

/** A price a provider announced for a later day: from `from` (UTC), it replaces the current one. */
type PriceChange = { from: string; model: string; pricing: ModelPricing };

/** Announced on the providers' pricing pages (checked 6 Oct 2026); add new ones here. */
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
