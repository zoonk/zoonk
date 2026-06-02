import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { normalizeString, segmentWords, stripPunctuation } from "@zoonk/utils/string";

type TargetWordHint = { key: string; translation: string };

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
 * Matches a prompt word against generated target-word translations.
 */
function getDirectTargetIndex({
  targetHints,
  word,
}: {
  targetHints: TargetWordHint[];
  word: string;
}): number | null {
  const key = getPromptWordKey(word);
  const index = targetHints.findIndex((hint) => hint.key === key);

  if (index === -1) {
    return null;
  }

  return index;
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

  const directTargetIndexes = promptWords.map((word) =>
    getDirectTargetIndex({ targetHints, word }),
  );

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
