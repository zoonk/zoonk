import { type CourseLevel } from "@zoonk/db";

/**
 * The longest sentence each level allows, in words. Lessons aim much shorter;
 * these limits only catch walls of text a learner at that level can't follow.
 */
const MAX_SENTENCE_WORDS: Readonly<Record<CourseLevel, number>> = {
  advanced: 45,
  beginner: 32,
  intermediate: 40,
  overview: 32,
};

/** One screen holds one idea: explanations stay short enough to read at a glance. */
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

/** Sentences longer than the level allows, with math spans counted as one word. */
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
