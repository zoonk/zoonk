import { normalizePunctuation, normalizeString } from "@zoonk/utils/string";

/**
 * Treats punctuation-spacing variants as the same generated word without
 * collapsing case or accents, which can carry meaning in the target language.
 */
export function getCanonicalWordKey(text: string): string {
  return normalizePunctuation(text).trim();
}

function getTargetKey(text: string): string {
  return normalizeString(getCanonicalWordKey(text));
}

export function collectTargetWords({
  canonicalWords,
  generatedWords,
}: {
  canonicalWords: string[];
  generatedWords: string[];
}): string[] {
  const seenCanonicalWords = new Set<string>();
  const seenGeneratedKeys = new Set<string>();
  const targetWords: string[] = [];

  for (const word of canonicalWords) {
    const canonicalWordKey = getCanonicalWordKey(word);

    if (canonicalWordKey && !seenCanonicalWords.has(canonicalWordKey)) {
      seenCanonicalWords.add(canonicalWordKey);
      seenGeneratedKeys.add(getTargetKey(word));
      targetWords.push(word);
    }
  }

  for (const word of generatedWords) {
    const normalizedWord = normalizePunctuation(word).trim();
    const key = getTargetKey(normalizedWord);

    if (key && !seenGeneratedKeys.has(key)) {
      seenGeneratedKeys.add(key);
      targetWords.push(normalizedWord);
    }
  }

  return targetWords;
}
