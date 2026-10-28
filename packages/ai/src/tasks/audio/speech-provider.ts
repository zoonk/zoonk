import { type TTSVoice, getBaseLanguage, getMaiVoiceLocale } from "@zoonk/utils/languages";
import { generateSpeech } from "ai";
import { zoonkGateway } from "../../gateway";
import { type ServiceTier } from "../../provider-options";
import { type SpeechModelName, speechModels } from "./speech-models";

/** MAI-Voice's Harper speaks every one of its languages, so every clip sounds like the same speaker. */
const MAI_VOICE_SPEAKER = "Harper";

function getMaiVoice(language: string): string {
  const locale = getMaiVoiceLocale(getBaseLanguage(language));

  if (!locale) {
    throw new Error(`MAI-Voice doesn't speak ${language}`);
  }

  return `${locale}-${MAI_VOICE_SPEAKER}`;
}

/**
 * MAI-Voice takes no instructions (only SSML styles, which the gateway drops), so its voice names
 * the language. No provider reads the AI SDK's `language` option (8 Oct 2026), so it isn't sent.
 * MAI-Voice has no service tier.
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
  const isMaiVoice = model === speechModels.maiVoiceFlash;

  const { audio, providerMetadata } = await generateSpeech({
    ...(isMaiVoice ? {} : { instructions }),
    model: zoonkGateway.speechModel(model),
    outputFormat: "wav",
    ...(serviceTier && !isMaiVoice ? { providerOptions: { gateway: { serviceTier } } } : {}),
    text,
    voice: isMaiVoice ? getMaiVoice(language) : voice,
  });

  return { audio: audio.uint8Array, providerMetadata };
}
