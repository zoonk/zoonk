import "server-only";
import { GoogleGenAI } from "@google/genai";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type TTSVoice, getLanguageName } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import promptTemplate from "./generate-language-audio.prompt.md";
import { wrapPCMInWAV } from "./wrap-pcm-in-wav";

const DEFAULT_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_VOICE: TTSVoice = "Kore";

function buildInstructions(languageCode: string | undefined): string {
  const languageName = languageCode
    ? getLanguageName({ targetLanguage: languageCode, userLanguage: "en" })
    : "English";

  return promptTemplate.replaceAll("{{LANGUAGE}}", () => languageName);
}

/**
 * Generates audio using the Google GenAI SDK with a Gemini TTS model.
 * Returns WAV audio bytes ready for playback in browsers.
 */
export async function generateLanguageAudio({
  language,
  text,
  voice = DEFAULT_VOICE,
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
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const instructions = buildInstructions(language);

    const response = await client.models.generateContent({
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
      contents: [{ parts: [{ text: `${instructions}\n\n${text}` }] }],
      model: DEFAULT_MODEL,
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      throw new Error("No audio data in Gemini response");
    }

    const pcmBytes = new Uint8Array(Buffer.from(audioData, "base64"));
    return { audio: wrapPCMInWAV(pcmBytes) };
  });

  if (error) {
    logError("Error generating language audio:", error);
    return { data: null, error };
  }

  return { data, error: null };
}
