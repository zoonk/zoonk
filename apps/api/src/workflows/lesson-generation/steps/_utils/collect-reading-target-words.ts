import { extractUniqueSentenceWords } from "@zoonk/utils/string";
import { collectTargetWords } from "./collect-target-words";
import { type ReadingLessonContent } from "./generated-lesson-content";

type ReadingSentence = ReadingLessonContent["sentences"][number];

export function collectReadingTargetWords({
  distractors,
  sentences,
}: {
  distractors: Record<string, string[]>;
  sentences: ReadingSentence[];
}): string[] {
  return collectTargetWords({
    canonicalWords: extractUniqueSentenceWords(sentences.map((entry) => entry.sentence)),
    generatedWords: sentences.flatMap((entry) => distractors[entry.sentence] ?? []),
  });
}
