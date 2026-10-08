import { type TTSVoice } from "@zoonk/utils/languages";
import { type SpeechModel, generateSpeech } from "ai";
import { directOpenAI } from "../../direct-providers";
import { zoonkGateway } from "../../gateway";
import { type SpeechModelName, speechModels } from "./speech-models";

/** OpenAI has its own voices; Marin is the closest to Gemini's Kore. */
const OPENAI_VOICE = "marin";

type SpeechProvider = { model: SpeechModel; voice: string };

/**
 * Gemini goes through AI Gateway; gpt-4o-mini-tts goes to OpenAI directly because the gateway
 * doesn't list it.
 */
function getSpeechProvider({
  model,
  voice,
}: {
  model: SpeechModelName;
  voice: TTSVoice;
}): SpeechProvider {
  if (model === speechModels.openai) {
    return { model: directOpenAI.speech("gpt-4o-mini-tts"), voice: OPENAI_VOICE };
  }

  return { model: zoonkGateway.speechModel(model), voice };
}

/**
 * Generates WAV with one model. Both providers return WAV, which adds only a small header to the
 * PCM samples, so the task applies one validation and encoding pipeline without codec-specific
 * branches. The instructions name the passage's language, which both providers follow; neither
 * reads the AI SDK's `language` option (it only logged a warning for every clip; checked 8 Oct
 * 2026), so it isn't sent. The provider metadata carries AI Gateway's routing and cost.
 */
export async function generateSpeechWithProvider({
  instructions,
  model,
  text,
  voice,
}: {
  instructions: string;
  model: SpeechModelName;
  text: string;
  voice: TTSVoice;
}): Promise<{ audio: Uint8Array; providerMetadata: Record<string, unknown> }> {
  const provider = getSpeechProvider({ model, voice });

  const { audio, providerMetadata } = await generateSpeech({
    instructions,
    model: provider.model,
    outputFormat: "wav",
    text,
    voice: provider.voice,
  });

  return { audio: audio.uint8Array, providerMetadata };
}
