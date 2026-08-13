import { normalizePunctuation, normalizeString } from "@zoonk/utils/string";

function getTargetKey(text: string): string {
  return normalizeString(normalizePunctuation(text).trim());
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
    if (word.trim() && !seenCanonicalWords.has(word)) {
      seenCanonicalWords.add(word);
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
