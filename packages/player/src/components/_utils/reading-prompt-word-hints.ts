import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { normalizeString, segmentWords, stripPunctuation } from "@zoonk/utils/string";

type TargetWordHint = { key: string; translation: string };

type DirectTargetIndexAssignment = {
  directTargetIndexes: (number | null)[];
  usedTargetIndexes: Set<number>;
};

export type ReadingPromptWordHint = { translation: string | null; word: string };

function stripEdgePunctuation(word: string): string {
  return word.replaceAll(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function getPromptWordKey(word?: string | null): string {
  return normalizeString(stripPunctuation(word ?? ""));
}

function toTargetWordHint(option: WordBankOption): TargetWordHint | null {
  const key = getPromptWordKey(option.translation);
  const translation = stripEdgePunctuation(option.word);

  if (!key || !translation) {
    return null;
  }

  return { key, translation };
}

function getTargetWordHints(sentenceWordOptions: WordBankOption[]): TargetWordHint[] {
  return sentenceWordOptions.flatMap((option) => {
    const hint = toTargetWordHint(option);
    return hint ? [hint] : [];
  });
}

function getPromptTranslation({
  directTargetIndexes,
  fallbackTargetIndexes,
  promptIndex,
  targetHints,
}: {
  directTargetIndexes: (number | null)[];
  fallbackTargetIndexes: Map<number, number>;
  promptIndex: number;
  targetHints: TargetWordHint[];
}): string | null {
  const targetIndex = directTargetIndexes[promptIndex] ?? fallbackTargetIndexes.get(promptIndex);

  if (targetIndex === undefined || targetIndex === null) {
    return null;
  }

  return targetHints[targetIndex]?.translation ?? null;
}

function getUnusedDirectTargetIndex({
  targetHints,
  usedTargetIndexes,
  word,
}: {
  targetHints: TargetWordHint[];
  usedTargetIndexes: Set<number>;
  word: string;
}): number | null {
  const key = getPromptWordKey(word);

  const index = targetHints.findIndex(
    (hint, targetIndex) => hint.key === key && !usedTargetIndexes.has(targetIndex),
  );

  if (index === -1) {
    return null;
  }

  return index;
}

function appendDirectTargetIndex({
  assignment,
  targetHints,
  word,
}: {
  assignment: DirectTargetIndexAssignment;
  targetHints: TargetWordHint[];
  word: string;
}): DirectTargetIndexAssignment {
  const index = getUnusedDirectTargetIndex({
    targetHints,
    usedTargetIndexes: assignment.usedTargetIndexes,
    word,
  });

  return {
    directTargetIndexes: [...assignment.directTargetIndexes, index],
    usedTargetIndexes:
      index === null
        ? assignment.usedTargetIndexes
        : new Set([...assignment.usedTargetIndexes, index]),
  };
}

function getDirectTargetIndexes({
  promptWords,
  targetHints,
}: {
  promptWords: string[];
  targetHints: TargetWordHint[];
}): (number | null)[] {
  const initialAssignment: DirectTargetIndexAssignment = {
    directTargetIndexes: [],
    usedTargetIndexes: new Set(),
  };

  const assignment = promptWords.reduce(
    (currentAssignment, word) =>
      appendDirectTargetIndex({ assignment: currentAssignment, targetHints, word }),
    initialAssignment,
  );

  return assignment.directTargetIndexes;
}

function getUsedTargetIndexes(directTargetIndexes: (number | null)[]): Set<number> {
  return new Set(directTargetIndexes.flatMap((index) => (index === null ? [] : [index])));
}

function getFallbackTargetIndexes({
  directTargetIndexes,
  targetHints,
}: {
  directTargetIndexes: (number | null)[];
  targetHints: TargetWordHint[];
}): number[] {
  const usedTargetIndexes = getUsedTargetIndexes(directTargetIndexes);
  return targetHints.flatMap((_hint, index) => (usedTargetIndexes.has(index) ? [] : [index]));
}

function getFallbackPromptIndexes(directTargetIndexes: (number | null)[]): number[] {
  return directTargetIndexes.flatMap((index, promptIndex) => (index === null ? [promptIndex] : []));
}

function buildFallbackTargetIndexMap({
  directTargetIndexes,
  targetHints,
}: {
  directTargetIndexes: (number | null)[];
  targetHints: TargetWordHint[];
}): Map<number, number> {
  const fallbackTargetIndexes = getFallbackTargetIndexes({ directTargetIndexes, targetHints });
  const fallbackPromptIndexes = getFallbackPromptIndexes(directTargetIndexes);

  return new Map(
    fallbackPromptIndexes.flatMap((promptIndex, index) => {
      const targetIndex = fallbackTargetIndexes[index];
      return targetIndex === undefined ? [] : [[promptIndex, targetIndex]];
    }),
  );
}

export function buildReadingPromptWordHints({
  prompt,
  sentenceWordOptions,
}: {
  prompt: string;
  sentenceWordOptions: WordBankOption[];
}): ReadingPromptWordHint[] {
  const promptWords = segmentWords(prompt);
  const targetHints = getTargetWordHints(sentenceWordOptions);

  const directTargetIndexes = getDirectTargetIndexes({ promptWords, targetHints });

  const fallbackTargetIndexes = buildFallbackTargetIndexMap({ directTargetIndexes, targetHints });

  return promptWords.map((word, promptIndex) => ({
    translation: getPromptTranslation({
      directTargetIndexes,
      fallbackTargetIndexes,
      promptIndex,
      targetHints,
    }),
    word,
  }));
}
