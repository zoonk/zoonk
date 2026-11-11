import { type CourseLevel } from "@zoonk/db";
import { replaceMath } from "@zoonk/utils/math-spans";

const MAX_SENTENCE_WORDS: Readonly<Record<CourseLevel, number>> = {
  advanced: 45,
  beginner: 32,
  intermediate: 40,
  overview: 32,
};

const SENTENCE_END = /(?<=[.!?…])\s+/u;
const WORD = /[\p{L}\p{N}]/u;

function countWords(sentence: string): number {
  return sentence.split(/\s+/u).filter((word) => WORD.test(word)).length;
}

export function findLongSentences({ level, text }: { level: CourseLevel; text: string }): string[] {
  const maxWords = MAX_SENTENCE_WORDS[level];

  return replaceMath(text, () => "x")
    .split(SENTENCE_END)
    .filter((sentence) => countWords(sentence) > maxWords);
}
