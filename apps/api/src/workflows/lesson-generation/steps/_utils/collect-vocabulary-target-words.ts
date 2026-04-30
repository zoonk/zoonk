import { collectTargetWords } from "./collect-target-words";

export function collectVocabularyTargetWords({
  distractors,
  words,
}: {
  distractors: Record<string, string[]>;
  words: { word: string }[];
}): string[] {
  return collectTargetWords({
    canonicalWords: words.map((entry) => entry.word),
    generatedWords: words.flatMap((entry) => distractors[entry.word] ?? []),
  });
}
