import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { toAudioData } from "../../../library/language/_utils/audio-data";
import { type FixContext } from "../handlers/fix-handler";
import { type VocabularyModel } from "../handlers/vocabulary-row";
import { type ContentFixMediaNeed, clipMediaKey } from "../media-schema";

type VocabularyClip = { language: string; model: VocabularyModel; text: string };

export function vocabularyClipNeed(
  clip: VocabularyClip & { orgSlug: string },
): Extract<ContentFixMediaNeed, { kind: "clip" }>[] {
  return isTTSSupportedLanguage(clip.language)
    ? [{ ...clip, key: clipMediaKey(clip), kind: "clip" }]
    : [];
}

export function readFixClip(context: FixContext, clip: VocabularyClip) {
  const produced = context.media.get(clipMediaKey(clip));

  if (produced?.kind !== "clip") {
    throw new Error(`Content fix ${context.fixId} has no clip for its text`);
  }

  return toAudioData(produced);
}
