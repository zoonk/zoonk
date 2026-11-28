import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type ClipEndingCheck, checkClipEnding } from "./check-clip-ending";

/** A learner can be waiting on a new phrase's clip, and no answer keeps it anyway. */
const CLIP_ENDING_CHECK_TIMEOUT_MS = 5000;

/** Voices finish a phrase left open, such as "vivo in"; a sentence ends where its text does. */
const SENTENCE_END = /[\p{Sentence_Terminal}…]["'”’»)\]]*$/u;

export type ClipAddition = Exclude<ClipEndingCheck["added"], "none">;

/** Null when nothing was added, and when the check can't answer: no audio is worse. */
export async function findClipAddition({
  analytics,
  audio,
  language,
  text,
}: {
  analytics?: AiGenerationContext;
  audio: Uint8Array;
  language: string;
  text: string;
}): Promise<ClipAddition | null> {
  if (SENTENCE_END.test(text.trim())) {
    return null;
  }

  const { data, error } = await safeAsync(() =>
    checkClipEnding({
      abortSignal: AbortSignal.timeout(CLIP_ENDING_CHECK_TIMEOUT_MS),
      analytics,
      audio,
      language,
      mediaType: "audio/mpeg",
      text,
    }),
  );

  if (error) {
    logError("Checking a clip's ending failed:", error);
    return null;
  }

  return data.data.added === "none" ? null : data.data.added;
}
