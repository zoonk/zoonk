import "server-only";
import { openai } from "@ai-sdk/openai";
import { type TTSVoice } from "@zoonk/utils/constants";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { experimental_generateSpeech as generateSpeech } from "ai";

const DEFAULT_MODEL = openai.speech("gpt-4o-mini-tts");

export async function generateLanguageAudio({
  language,
  text,
  voice = "marin",
}: {
  language?: string;
  text: string;
  voice?: TTSVoice;
}): Promise<
  SafeReturn<{
    audio: Uint8Array;
  }>
> {
  const { data, error } = await safeAsync(async () => {
    const { audio } = await generateSpeech({
      instructions: `Speak clearly and at a moderate pace suitable for language learners. Enunciate each word precisely in this language: ${language}.`,
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
