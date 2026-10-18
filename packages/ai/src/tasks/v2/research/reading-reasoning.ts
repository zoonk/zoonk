import { type Reasoning } from "../../../provider-options";
import { type ResearchDocument } from "./research-documents";

/**
 * Documents this short (a page or two of class notes, a short syllabus) are read at low
 * reasoning: a teacher's one-page notes (1,945 characters) took 283 s and 39,104 reasoning tokens
 * at the model's default on 7 Oct 2026, where whole notices take one to three minutes. A photo
 * counts as a page; a file whose text wasn't extracted can't be sized, so it reads at the default.
 */
const SHORT_READING_CHARS = 20_000;
const PHOTO_CHARS = 3000;

function estimateReadingChars(documents: readonly ResearchDocument[]): number | null {
  return documents.reduce<number | null>((total, document) => {
    if (total === null) {
      return null;
    }

    if (document.text !== null) {
      return total + document.text.length;
    }

    return document.file?.mediaType.startsWith("image/") ? total + PHOTO_CHARS : null;
  }, 0);
}

/** The caller's reasoning, or low for short documents (`SHORT_READING_CHARS`). */
export function getReadingReasoning({
  documents,
  reasoning,
}: {
  documents: readonly ResearchDocument[];
  reasoning?: Reasoning;
}): Reasoning | undefined {
  if (reasoning) {
    return reasoning;
  }

  const chars = estimateReadingChars(documents);
  return chars !== null && chars <= SHORT_READING_CHARS ? "low" : undefined;
}
