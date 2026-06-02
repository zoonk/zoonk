import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { normalizeString, segmentWords, stripPunctuation } from "@zoonk/utils/string";

type TargetWordHint = { key: string; translation: string };

type DirectTargetIndexAssignment = {
  directTargetIndexes: (number | null)[];
  usedTargetIndexes: Set<number>;
};

export type ReadingPromptWordHint = { translation: string | null; word: string };

/**
 * Removes sentence punctuation from a word shown inside a tiny definition
 * popover while preserving internal connectors such as apostrophes.
 */
function stripEdgePunctuation(word: string): string {
  return word.replaceAll(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * Converts visible prompt words and stored word translations into the same
 * lookup key so accents, case, and punctuation do not block a reliable match.
 */
function getPromptWordKey(word?: string | null): string {
  return normalizeString(stripPunctuation(word ?? ""));
}

/**
 * Converts a target sentence word option into a compact hint candidate.
 *
 * Reading generation stores target-word metadata as target word plus
 * learner-language translation. The prompt shows the learner-language sentence,
 * so this helper inverts that metadata for prompt-word popovers.
 */
function toTargetWordHint(option: WordBankOption): TargetWordHint | null {
  const key = getPromptWordKey(option.translation);
  const translation = stripEdgePunctuation(option.word);

  if (!key || !translation) {
    return null;
  }

  return { key, translation };
}

/**
 * Returns only the usable target-word hint candidates from the serialized
 * sentence metadata.
 */
function getTargetWordHints(sentenceWordOptions: WordBankOption[]): TargetWordHint[] {
  return sentenceWordOptions.flatMap((option) => {
    const hint = toTargetWordHint(option);
    return hint ? [hint] : [];
  });
}

/**
 * Finds the strongest target-word hint for one visible prompt word.
 *
 * Exact translation matches are preferred because they are explicit generated
 * metadata. Position fallback is only used for remaining words so common
 * language-order flips, such as "você está" -> "are you", still get a useful
 * hint when one word did not match exactly.
 */
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

/**
 * Matches a prompt word against the first generated target-word translation
 * that has not already powered an earlier prompt word.
 *
 * Repeated prompt words can share a lookup key while still mapping to distinct
 * target sentence words. Consuming each target hint once keeps those repeated
 * words from all pointing at the first matching hint.
 */
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

/**
 * Adds one prompt word's exact match while preserving target hints that were
 * already assigned to earlier visible words.
 */
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

/**
 * Assigns exact prompt-word matches from left to right before the looser
 * position fallback runs.
 */
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

/**
 * Returns the indexes of target hints that were already consumed by exact
 * prompt-word matches.
 */
function getUsedTargetIndexes(directTargetIndexes: (number | null)[]): Set<number> {
  return new Set(directTargetIndexes.flatMap((index) => (index === null ? [] : [index])));
}

/**
 * Returns the target indexes that are still available for order-based fallback
 * matching after exact matches are removed.
 */
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

/**
 * Returns the prompt indexes that still need an order-based fallback hint.
 */
function getFallbackPromptIndexes(directTargetIndexes: (number | null)[]): number[] {
  return directTargetIndexes.flatMap((index, promptIndex) => (index === null ? [promptIndex] : []));
}

/**
 * Pairs unmatched prompt words with unmatched target words in order.
 *
 * This fallback is intentionally conservative: it only fills gaps left after
 * exact translation matches, so obvious generated metadata always wins.
 */
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

/**
 * Builds the prompt sentence tokens used by the reading UI.
 *
 * The player already has target-word metadata, but learners tap the visible
 * prompt sentence. This helper bridges those shapes without changing the
 * serialized lesson contract.
 */
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
