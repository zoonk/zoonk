import { segmentWords, stripPunctuation } from "@zoonk/utils/string";

const SEQUENCE_SEPARATOR = "\u0000";

function normalizeArrangeWord(word: string): string {
  return stripPunctuation(word).toLowerCase().trim();
}

function getSequenceKey(words: string[]): string {
  return words.map((word) => normalizeArrangeWord(word)).join(SEQUENCE_SEPARATOR);
}

export function buildAcceptedArrangeWordSequences(
  primaryText: string,
  alternatives: string[],
): string[][] {
  const sequences = [primaryText, ...alternatives].flatMap((text) => {
    const words = segmentWords(text);
    return words.length > 0 ? [words] : [];
  });

  return [...new Map(sequences.map((words) => [getSequenceKey(words), words] as const)).values()];
}

export function buildAcceptedWordBankWords(acceptedWordSequences: string[][]): string[] {
  const maxCounts = new Map<string, { count: number; word: string }>();

  for (const words of acceptedWordSequences) {
    const sequenceCounts = new Map<string, { count: number; word: string }>();

    for (const word of words) {
      const key = normalizeArrangeWord(word);

      if (key) {
        const current = sequenceCounts.get(key);
        sequenceCounts.set(key, {
          count: (current?.count ?? 0) + 1,
          word: current?.word ?? word,
        });
      }
    }

    for (const [key, value] of sequenceCounts) {
      const current = maxCounts.get(key);

      if (!current || value.count > current.count) {
        maxCounts.set(key, value);
      }
    }
  }

  return [...maxCounts.values()].flatMap(({ count, word }) =>
    Array.from({ length: count }, () => word),
  );
}

export function getAcceptedArrangeWordLengths(acceptedWordSequences: string[][]): number[] {
  return [
    ...new Set(acceptedWordSequences.flatMap((words) => (words.length > 0 ? [words.length] : []))),
  ].toSorted((left, right) => left - right);
}

export function getAcceptedArrangeWordSet(acceptedWordSequences: string[][]): Set<string> {
  return new Set(
    acceptedWordSequences.flatMap((words) =>
      words.flatMap((word) => {
        const normalized = normalizeArrangeWord(word);
        return normalized ? [normalized] : [];
      }),
    ),
  );
}

export function matchesAcceptedArrangeWords(
  acceptedWordSequences: string[][],
  userWords: string[],
): boolean {
  const normalizedUserWords = userWords.map((word) => normalizeArrangeWord(word));

  return acceptedWordSequences.some(
    (words) =>
      words.length === normalizedUserWords.length &&
      words.every((word, index) => normalizeArrangeWord(word) === normalizedUserWords[index]),
  );
}
