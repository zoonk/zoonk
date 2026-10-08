import { type SpeechModelName } from "@zoonk/ai/speech-models";
import {
  type LanguageAudioUsage,
  type SpeechProvenance,
  generateLanguageAudio as generateAudio,
} from "@zoonk/ai/tasks/audio";
import { type SafeReturn } from "@zoonk/utils/error";
import { type TTSVoice } from "@zoonk/utils/languages";
import { toSlug } from "@zoonk/utils/string";
import { uploadAudio } from "./upload-audio";

/** Voices a word or sentence and uploads the clip; the result names the run that voiced it. */
export async function generateLanguageAudio({
  language,
  model,
  orgSlug,
  text,
  usage,
  voice,
}: {
  language: string;
  model?: SpeechModelName;
  orgSlug?: string;
  text: string;
  usage?: LanguageAudioUsage;
  voice?: TTSVoice;
}): Promise<SafeReturn<{ provenance: SpeechProvenance; url: string }>> {
  const { data: audioResult, error: generateError } = await generateAudio({
    language,
    ...(model ? { model } : {}),
    text,
    ...(voice ? { voice } : {}),
    ...(usage ? { usage } : {}),
  });

  if (generateError) {
    return { data: null, error: generateError };
  }

  const slug = toSlug(text);
  const fileName = `audio/${orgSlug ?? "default"}/${slug}.${audioResult.format}`;

  const { data: url, error: uploadError } = await uploadAudio({
    audio: audioResult.audio,
    fileName,
  });

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  return { data: { provenance: audioResult.provenance, url }, error: null };
}
