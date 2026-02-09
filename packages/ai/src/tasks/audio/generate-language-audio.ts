import "server-only";
import { openai } from "@ai-sdk/openai";
import { type TTSVoice } from "@zoonk/utils/constants";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { experimental_generateSpeech as generateSpeech } from "ai";

const DEFAULT_MODEL = openai.speech("gpt-4o-mini-tts");

export type GenerateLanguageAudioParams = {
  text: string;
  voice?: TTSVoice;
};

export type GenerateLanguageAudioResult = {
  audio: Uint8Array;
};

export async function generateLanguageAudio({
  text,
  voice = "marin",
}: GenerateLanguageAudioParams): Promise<SafeReturn<GenerateLanguageAudioResult>> {
  const { data, error } = await safeAsync(async () => {
    const { audio } = await generateSpeech({
      instructions: "Speak clearly and at a moderate pace suitable for language learners. Enunciate each word precisely.",
      model: DEFAULT_MODEL,
      outputFormat: "opus",
      text,
      voice,
    });

    return { audio: audio.uint8Array };
  });

  if (error) {
    console.error("Error generating language audio:", error);
    return { data: null, error };
  }

  return { data, error: null };
}
