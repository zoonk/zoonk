import { openai } from "@ai-sdk/openai";
import { type TTSVoice } from "@zoonk/utils/languages";
import { experimental_generateSpeech as generateSpeech } from "ai";
import { type AudioResult } from "./generate-language-audio";

const MODEL = openai.speech("gpt-4o-mini-tts");

/**
 * OpenAI voices don't map 1:1 to Gemini voices.
 * We pick a reasonable OpenAI default regardless of
 * the Gemini voice requested since this is a fallback.
 */
const OPENAI_VOICE = "marin";

/**
 * Generates audio using OpenAI's TTS API as a fallback provider.
 * Returns opus audio directly (no conversion needed).
 */
export async function generateWithOpenAI({
  instructions,
  text,
}: {
  instructions: string;
  text: string;
  voice: TTSVoice;
}): Promise<AudioResult> {
  const { audio } = await generateSpeech({
    instructions,
    model: MODEL,
    outputFormat: "opus",
    text,
    voice: OPENAI_VOICE,
  });

  return { audio: audio.uint8Array, format: "opus" };
}
