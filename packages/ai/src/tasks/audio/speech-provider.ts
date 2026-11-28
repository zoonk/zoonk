import { type TTSVoice } from "@zoonk/utils/languages";
import { generateSpeech } from "ai";
import { NO_PROMPT_TRAINING } from "../../data-protection";
import { zoonkGateway } from "../../gateway";
import { type ServiceTier } from "../../provider-options";
import { type SpeechModelName, speechModels } from "./speech-models";
import { getSpeechRequest } from "./speech-request";

/**
 * No provider reads the AI SDK's `language` option (8 Oct 2026), so it isn't sent. MAI-Voice has
 * no service tier.
 */
export async function generateSpeechWithProvider({
  instructions,
  language,
  model,
  serviceTier,
  text,
  voice,
}: {
  instructions: string;
  /** MAI-Voice picks its voice by it. */
  language: string;
  model: SpeechModelName;
  serviceTier?: ServiceTier;
  text: string;
  voice: TTSVoice;
}): Promise<{ audio: Uint8Array; providerMetadata: Record<string, unknown> }> {
  const tier = model === speechModels.maiVoiceFlash ? undefined : serviceTier;

  const { audio, providerMetadata } = await generateSpeech({
    ...getSpeechRequest({ instructions, language, model, voice }),
    model: zoonkGateway.speechModel(model),
    outputFormat: "wav",
    providerOptions: { gateway: { ...NO_PROMPT_TRAINING, ...(tier ? { serviceTier: tier } : {}) } },
    text,
  });

  return { audio: audio.uint8Array, providerMetadata };
}
