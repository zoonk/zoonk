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

/** Dollars per minute of audio of OpenAI's speech and transcription models. */
const OPENAI_AUDIO_USD_PER_MINUTE = { speech: 0.015, transcription: 0.0045 } as const;

/** gpt-4o-mini-tts's text input: $0.60 per million tokens, on top of its audio. */
const OPENAI_SPEECH_TEXT_USD_PER_MILLION = 0.6;

function perMinute({ text = 0, usd }: { text?: number; usd: number }): ModelPricing {
  return { input: text / TOKENS_PER_MILLION, output: 0, perSecond: usd / SECONDS_PER_MINUTE };
}

/**
 * Models we call that the gateway's list doesn't price, from the providers' pricing pages
 * (checked 6 Oct 2026): Google's speech models, priced by the text they read and their audio
 * tokens; gpt-4o-mini-tts, about $0.015 a minute of speech plus its text; and gpt-transcribe,
 * $0.0045 a minute, which goes to OpenAI directly.
 */
export const PRICE_OVERRIDES: Readonly<Record<string, ModelPricing>> = {
  "google/gemini-2.5-flash-preview-tts": geminiSpeech({ audio: 10, text: 0.5 }),
  "google/gemini-3.8-flash-lite-tts": geminiSpeech({ audio: 6, text: 0.5 }),
  "google/gemini-3.8-flash-tts": geminiSpeech({ audio: 9, text: 0.5 }),
  "openai/gpt-4o-mini-tts": perMinute({
    text: OPENAI_SPEECH_TEXT_USD_PER_MILLION,
    usd: OPENAI_AUDIO_USD_PER_MINUTE.speech,
  }),
  "openai/gpt-transcribe": perMinute({ usd: OPENAI_AUDIO_USD_PER_MINUTE.transcription }),
};

/** A price a provider announced for a later day: from `from` (UTC), it replaces the current one. */
type PriceChange = { from: string; model: string; pricing: ModelPricing };

/** Announced on the providers' pricing pages (checked 6 Oct 2026); add new ones here. */
export const PRICE_CHANGES: readonly PriceChange[] = [
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
