import { GoogleGenAI } from "@google/genai";
import { type TTSVoice } from "@zoonk/utils/languages";
import { type AudioResult } from "./generate-language-audio";
import { wrapPCMInWAV } from "./wrap-pcm-in-wav";

const MODEL = "gemini-2.5-flash-preview-tts";

/* oxlint-disable-next-line no-magic-numbers -- 850 KiB is the prompt-leak failure threshold observed in generated audio files. */
const MAX_GEMINI_AUDIO_BYTES = 850 * 1024;

/**
 * Keeps Gemini TTS guidance in the prompt content because the speech-generation
 * docs show style, accent, and pacing control as natural-language text in
 * `contents`, and runtime checks show `systemInstruction` can be ignored by the
 * TTS model for language pronunciation. The final labeled line gives Gemini a
 * small target after the instructions instead of leaving it to infer what text
 * should be spoken from the whole prompt.
 */
function buildGeminiPrompt({ instructions, text }: { instructions: string; text: string }) {
  return `${instructions}\n\nText to speak exactly:\n${text}`;
}

/**
 * Rejects Gemini audio that is too long to be a normal word or learner
 * sentence. When Gemini starts reading prompt instructions, the raw PCM output
 * becomes much larger than expected, so treating the size as a provider
 * failure lets the shared fallback path regenerate clean audio.
 */
function assertExpectedAudioSize(audio: Uint8Array) {
  if (audio.byteLength <= MAX_GEMINI_AUDIO_BYTES) {
    return;
  }

  throw new Error(
    `Gemini TTS returned oversized audio: ${audio.byteLength} bytes. Expected at most ${MAX_GEMINI_AUDIO_BYTES} bytes.`,
  );
}

/**
 * Generates audio using the Google GenAI SDK with a Gemini TTS model.
 * Returns WAV audio because Gemini outputs raw PCM which needs
 * a WAV header for browser playback.
 */
export async function generateWithGemini({
  instructions,
  languageCode,
  text,
  voice,
}: {
  instructions: string;
  languageCode?: string;
  text: string;
  voice: TTSVoice;
}): Promise<AudioResult> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const response = await client.models.generateContent({
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        ...(languageCode ? { languageCode } : {}),
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
      },
    },
    contents: [{ parts: [{ text: buildGeminiPrompt({ instructions, text }) }] }],
    model: MODEL,
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioData) {
    throw new Error("No audio data in Gemini response");
  }

  const pcmBytes = new Uint8Array(Buffer.from(audioData, "base64"));
  const wavAudio = wrapPCMInWAV(pcmBytes);
  assertExpectedAudioSize(wavAudio);

  return { audio: wavAudio, format: "wav" };
}
