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
  const seenTargetKeys = new Set<string>();
  const targetWords: string[] = [];

  for (const word of canonicalWords) {
    const key = getTargetKey(word);

    if (key && !seenTargetKeys.has(key)) {
      seenTargetKeys.add(key);
      targetWords.push(word);
    }
  }

  for (const word of generatedWords) {
    const normalizedWord = normalizePunctuation(word).trim();
    const key = getTargetKey(normalizedWord);

    if (key && !seenTargetKeys.has(key)) {
      seenTargetKeys.add(key);
      targetWords.push(normalizedWord);
    }
  }

  return targetWords;
}
