import { segmentLearnerWords, segmentWords, stripPunctuation } from "@zoonk/utils/string";

const SEQUENCE_SEPARATOR = "\u0000";

function normalizeArrangeWord(word: string): string {
  return stripPunctuation(word).toLowerCase().trim();
}

function getSequenceKey(words: string[]): string {
  return words.map((word) => normalizeArrangeWord(word)).join(SEQUENCE_SEPARATOR);
}

type ArrangeText = { kind: "listening" | "reading"; text: string };

/** A reading builds the sentence in the language learned; a listening, its translation in the learner's. */
function segmentArrangeWords({ kind, text }: ArrangeText): string[] {
  return kind === "listening" ? segmentLearnerWords(text) : segmentWords(text);
}

/** Blank or punctuation-only text has no accepted sequence. */
export function buildAcceptedArrangeWordSequences(params: ArrangeText): string[][] {
  const words = segmentArrangeWords(params);
  return words.length > 0 ? [words] : [];
}

export function getAcceptedArrangeWordLengths(acceptedWordSequences: string[][]): number[] {
  return acceptedWordSequences.map((words) => words.length);
}

/** Matching ignores punctuation, casing, and surrounding whitespace. */
export function matchesAcceptedArrangeWords(
  acceptedWordSequences: string[][],
  userWords: string[],
): boolean {
  const userSequenceKey = getSequenceKey(userWords);

  return acceptedWordSequences.some((words) => getSequenceKey(words) === userSequenceKey);
}
