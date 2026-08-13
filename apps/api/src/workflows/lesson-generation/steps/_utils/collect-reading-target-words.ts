import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { collectTargetWords } from "./collect-target-words";
import { type ReadingLessonContent } from "./generated-lesson-content";

type ReadingSentence = ReadingLessonContent["sentences"][number];

/** Returns unique canonical word tokens in their first sentence order. */
function collectReadingSentenceWords(sentences: ReadingSentence[]): string[] {
  return extractUniqueSentenceWords(sentences.map((entry) => entry.sentence));
}

/** Keeps only canonical sentence words that have learner-facing translations. */
export function collectTranslatedReadingWords({
  sentences,
  wordMetadata,
}: {
  sentences: ReadingSentence[];
  wordMetadata: Record<string, { translation: string }>;
}): string[] {
  return collectReadingSentenceWords(sentences).filter((word) => wordMetadata[word]?.translation);
}

/** Collects canonical sentence words plus generated target-language distractors. */
export function collectReadingTargetWords({
  distractors,
  sentences,
}: {
  distractors: Record<string, string[]>;
  sentences: ReadingSentence[];
}): string[] {
  return collectTargetWords({
    canonicalWords: collectReadingSentenceWords(sentences),
    generatedWords: sentences.flatMap((entry) => distractors[entry.sentence] ?? []),
  });
}
