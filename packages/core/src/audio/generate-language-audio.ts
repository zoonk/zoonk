import "server-only";

import { generateLanguageAudio as generateAudio } from "@zoonk/ai/tasks/audio";
import type { TTSVoice } from "@zoonk/utils/constants";
import type { SafeReturn } from "@zoonk/utils/error";
import { toSlug } from "@zoonk/utils/string";
import { uploadAudio } from "./upload-audio";

export type GenerateLanguageAudioParams = {
  language?: string;
  orgSlug: string;
  text: string;
  voice?: TTSVoice;
};

export async function generateLanguageAudio({
  language,
  orgSlug,
  text,
  voice,
}: GenerateLanguageAudioParams): Promise<SafeReturn<string>> {
  const { data: audioResult, error: generateError } = await generateAudio({
    language,
    text,
    voice,
  });

  if (generateError) {
    return { data: null, error: generateError };
  }

  const slug = toSlug(text);
  const fileName = `audio/${orgSlug}/${slug}.opus`;

  const { data: url, error: uploadError } = await uploadAudio({
    audio: audioResult.audio,
    fileName,
  });

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  return { data: url, error: null };
}
