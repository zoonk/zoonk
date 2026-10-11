import { type TTSVoice, getBaseLanguage, getMaiVoiceLocale } from "@zoonk/utils/languages";
import { generateSpeech } from "ai";
import { zoonkGateway } from "../../gateway";
import { type ServiceTier } from "../../provider-options";
import { generateRealtimeSpeech } from "./realtime-speech";
import { type SpeechModelName, speechModels } from "./speech-models";

/** OpenAI has its own voices; Marin is the closest to Gemini's Kore. */
const OPENAI_VOICE = "marin";

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
 * Generates WAV with one model. Every provider returns WAV, which adds only a small header to the
 * PCM samples, so the task applies one validation and encoding pipeline without codec-specific
 * branches. Gemini and MAI-Voice go through AI Gateway; gpt-realtime-2.1-mini goes to OpenAI
 * directly over a realtime session because the gateway doesn't list it. The instructions name the
 * passage's language, which Gemini and OpenAI follow; MAI-Voice takes none (only SSML styles, so
 * the gateway warns and drops them), and its voice names the language instead. None reads the AI
 * SDK's `language` option (it only logged a warning for every clip; checked 8 Oct 2026), so it
 * isn't sent. The provider metadata carries AI Gateway's routing and cost. A service tier goes to
 * Gemini (`chooseServiceTier`); the other providers have none.
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
  /** The passage's language, such as "pt": MAI-Voice picks its voice by it. */
  language: string;
  model: SpeechModelName;
  serviceTier?: ServiceTier;
  text: string;
  voice: TTSVoice;
}): Promise<{ audio: Uint8Array; providerMetadata: Record<string, unknown> }> {
  if (model === speechModels.openaiRealtimeMini) {
    return generateRealtimeSpeech({
      instructions,
      model: "gpt-realtime-2.1-mini",
      text,
      voice: OPENAI_VOICE,
    });
  }

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
