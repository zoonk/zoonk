import { GoogleGenAI } from "@google/genai";
import { type TTSVoice } from "@zoonk/utils/languages";
import { type AudioResult } from "./generate-language-audio";
import { wrapPCMInWAV } from "./wrap-pcm-in-wav";

const MODEL = "gemini-2.5-flash-preview-tts";

/**
 * Generates audio using the Google GenAI SDK with a Gemini TTS model.
 * Returns WAV audio because Gemini outputs raw PCM which needs
 * a WAV header for browser playback.
 */
export async function generateWithGemini({
  instructions,
  text,
  voice,
}: {
  instructions: string;
  text: string;
  voice: TTSVoice;
}): Promise<AudioResult> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    model: MODEL,
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioData) {
    throw new Error("No audio data in Gemini response");
  }

  const pcmBytes = new Uint8Array(Buffer.from(audioData, "base64"));
  return { audio: wrapPCMInWAV(pcmBytes), format: "wav" };
}
