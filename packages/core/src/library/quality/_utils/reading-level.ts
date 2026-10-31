import { type CourseLevel } from "@zoonk/db";

const MAX_SENTENCE_WORDS: Readonly<Record<CourseLevel, number>> = {
  advanced: 45,
  beginner: 32,
  intermediate: 40,
  overview: 32,
};

const MAX_EXPLANATION_CHARACTERS: Readonly<Record<CourseLevel, number>> = {
  advanced: 900,
  beginner: 650,
  intermediate: 750,
  overview: 650,
};

const MATH_SPAN = /\$[^$]+\$/gu;
const SENTENCE_END = /(?<=[.!?…])\s+/u;
const WORD = /[\p{L}\p{N}]/u;

function countWords(sentence: string): number {
  return sentence.split(/\s+/u).filter((word) => WORD.test(word)).length;
}

export function findLongSentences({ level, text }: { level: CourseLevel; text: string }): string[] {
  const maxWords = MAX_SENTENCE_WORDS[level];

  return text
    .replaceAll(MATH_SPAN, "x")
    .split(SENTENCE_END)
    .filter((sentence) => countWords(sentence) > maxWords);
}

export function getMaxExplanationCharacters(level: CourseLevel): number {
  return MAX_EXPLANATION_CHARACTERS[level];
}
