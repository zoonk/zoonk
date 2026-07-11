import { createGoogle } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { type TTSVoice } from "@zoonk/utils/languages";
import { type SpeechModel } from "ai";
import { type SpeechModelName, speechModels } from "./speech-models";

export type AudioFormat = "opus" | "wav";

type SpeechProvider = { format: AudioFormat; model: SpeechModel; voice: string };

const google = createGoogle({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Removes the provider prefix after the typed model registry has already
 * established which provider owns the model. Provider SDKs expect the bare
 * model id, while task callers use provider-qualified names consistently with
 * the rest of the AI package.
 */
function getProviderModelId(model: SpeechModelName): string {
  const separatorIndex = model.indexOf("/");
  return model.slice(separatorIndex + 1);
}

/**
 * Resolves a provider-qualified model name into the AI SDK speech model and
 * provider-specific output settings. Gemini only returns PCM, which the Google
 * provider wraps as WAV, while OpenAI can return Opus directly. OpenAI voices
 * do not map one-to-one to Gemini voices, so its stable fallback voice remains
 * `marin` regardless of the requested Gemini voice.
 */
export function getSpeechProvider({
  model,
  voice,
}: {
  model: SpeechModelName;
  voice: TTSVoice;
}): SpeechProvider {
  const modelId = getProviderModelId(model);

  if (model === speechModels.google) {
    return { format: "wav", model: google.speech(modelId), voice };
  }

  if (model === speechModels.openai) {
    return { format: "opus", model: openai.speech(modelId), voice: "marin" };
  }

  throw new Error("Unsupported speech model");
}
