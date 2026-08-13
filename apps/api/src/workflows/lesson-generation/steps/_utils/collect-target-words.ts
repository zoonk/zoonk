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
    const normalizedWord = normalizePunctuation(word).trim();

    if (normalizedWord && !seenCanonicalWords.has(normalizedWord)) {
      seenCanonicalWords.add(normalizedWord);
      seenGeneratedKeys.add(getTargetKey(normalizedWord));
      targetWords.push(normalizedWord);
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
