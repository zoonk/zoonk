import { normalizeString } from "@zoonk/utils/string";

const ITEM_NUMBER = /^\s*\d+(?:\.\d+)*[.)]?\s+/u;

export function toTopicKey(topic: string): string {
  return normalizeString(topic.replace(ITEM_NUMBER, ""));
}

const STEM_LENGTH = 6;

const MIN_STEM_WORD = 4;

export function toStems(text: string): string[] {
  return toTopicKey(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_STEM_WORD)
    .map((word) => word.slice(0, STEM_LENGTH));
}
