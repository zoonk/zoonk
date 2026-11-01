import {
  segmentWords,
  stripPunctuation,
  stripWrappingQuotes,
  trimPunctuation,
} from "@zoonk/utils/string";
import { type WordBankOption } from "./prepare-lesson-data";

export type ReadingPromptWord = { translation: string | null; word: string };

type SentenceWordHint = { key: string; translation: string };

type PromptMatch = { promptWords: ReadingPromptWord[]; usedHintIndexes: number[] };

function toMatchKey(text: string): string {
  return stripPunctuation(text.normalize("NFC")).toLowerCase().trim();
}

function isSameWord(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function toSentenceWordHints(sentenceWordOptions: WordBankOption[]): SentenceWordHint[] {
  const hints = sentenceWordOptions.flatMap((option) => {
    const key = toMatchKey(option.translation ?? "");
    const translation = trimPunctuation(option.word);
    return key && translation ? [{ key, translation }] : [];
  });

  return hints.filter((hint) =>
    hints.every(
      (other) => other.key !== hint.key || isSameWord(other.translation, hint.translation),
    ),
  );
}

function matchPromptWord({
  hints,
  match,
  word,
}: {
  hints: SentenceWordHint[];
  match: PromptMatch;
  word: string;
}): PromptMatch {
  const key = toMatchKey(word);

  const index = hints.findIndex(
    (hint, hintIndex) => hint.key === key && !match.usedHintIndexes.includes(hintIndex),
  );

  const hint = hints[index];

  if (!hint) {
    return { ...match, promptWords: [...match.promptWords, { translation: null, word }] };
  }

  return {
    promptWords: [...match.promptWords, { translation: hint.translation, word }],
    usedHintIndexes: [...match.usedHintIndexes, index],
  };
}

/**
 * The prompt is the sentence in the learner's language. A prompt word shows the sentence word
 * whose translation it is, accents included ("avó", "avô"), and nothing when no translation is
 * that word or two different sentence words share it: a guessed pairing would teach a wrong meaning.
 */
export function buildReadingPromptWords({
  prompt,
  sentenceWordOptions,
}: {
  prompt: string;
  sentenceWordOptions: WordBankOption[];
}): ReadingPromptWord[] {
  const hints = toSentenceWordHints(sentenceWordOptions);
  const initial: PromptMatch = { promptWords: [], usedHintIndexes: [] };

  return segmentWords(stripWrappingQuotes(prompt)).reduce(
    (match, word) => matchPromptWord({ hints, match, word }),
    initial,
  ).promptWords;
}
