import { normalizeString } from "@zoonk/utils/string";

/** A syllabus item's number ("5.7 ", "2) "), which a reading of the notice may or may not keep. */
const ITEM_NUMBER = /^\s*\d+(?:\.\d+)*[.)]?\s+/u;

/**
 * A topic as plans, notices and lookups compare it: the same words written otherwise, with or
 * without the item's number, so a plan built before its notice was read again (now with every item
 * numbered) still says which topics it teaches.
 */
export function toTopicKey(topic: string): string {
  return normalizeString(topic.replace(ITEM_NUMBER, ""));
}

/** The letters a word's stem keeps: "eletricidade" and "elétricos" share "eletri". */
const STEM_LENGTH = 6;

/** Shorter words ("de", "das", "com") join a topic's words; they never decide a match. */
const MIN_STEM_WORD = 4;

/** The stems of a text's meaningful words, as topics are matched by (see `toTopicKey`). */
export function toStems(text: string): string[] {
  return toTopicKey(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_STEM_WORD)
    .map((word) => word.slice(0, STEM_LENGTH));
}
