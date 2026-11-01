import {
  segmentWords,
  splitEdgePunctuation,
  stripWrappingQuotes,
  trimPunctuation,
  wordSeparator,
} from "@zoonk/utils/string";
import { type LessonLanguages } from "./build-word-bank-options";

/** `word` is one word of the prompt, or a phrase the lesson translates as a unit ("o portão"). */
export type ReadingPromptWord = { translation: string | null; word: string };

type VocabularyWord = { translation: string; word: string };

type Token = { after: string; before: string; key: string };

type SplitText = { separator: string; tokens: Token[]; words: string[] };

type Hint = {
  promptPhrase: Token[];
  sentenceEnd: number;
  sentenceKeys: string[];
  sentenceStart: number;
  sentenceWords: string;
};

type PromptMatch = { next: number; promptWords: ReadingPromptWord[]; usedHints: Hint[] };

/** Keeps the apostrophes inside a word: "I'll" isn't "ill". */
function toToken({ language, word }: { language: string; word: string }): Token {
  const { after, before, word: letters } = splitEdgePunctuation(word.normalize("NFC"));
  return { after, before, key: letters.replaceAll(/[‘’]/gu, "'").toLocaleLowerCase(language) };
}

function splitText({ language, text }: { language: string; text: string }): SplitText {
  const words = segmentWords(text);

  return {
    separator: wordSeparator(text),
    tokens: words.map((word) => toToken({ language, word })),
    words,
  };
}

function joinSpan({ end, start, text }: { end: number; start: number; text: SplitText }): string {
  return text.words.slice(start, end).join(text.separator);
}

function hasLetters(phrase: Token[]): boolean {
  return phrase.some((token) => token.key);
}

function isSamePhrase(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((key, index) => key === second[index]);
}

/** Only a phrase's edges may differ in punctuation: "her, man" isn't "her man". */
function startsAt({ phrase, start, tokens }: { phrase: Token[]; start: number; tokens: Token[] }) {
  return phrase.every((token, offset) => {
    const other = tokens[start + offset];

    return (
      other?.key === token.key &&
      (offset === 0 || other.before === token.before) &&
      (offset === phrase.length - 1 || other.after === token.after)
    );
  });
}

function appearsIn({ phrase, text }: { phrase: Token[]; text: SplitText }): boolean {
  return text.tokens.some((_token, start) => startsAt({ phrase, start, tokens: text.tokens }));
}

function overlaps(first: Hint, second: Hint): boolean {
  return first.sentenceStart < second.sentenceEnd && second.sentenceStart < first.sentenceEnd;
}

function spanLength(hint: Hint): number {
  return hint.sentenceEnd - hint.sentenceStart;
}

function findInSentence({
  languages,
  sentence,
  vocabularyWord,
}: {
  languages: LessonLanguages;
  sentence: SplitText;
  vocabularyWord: VocabularyWord;
}): Hint[] {
  const phrase = splitText({
    language: languages.targetLanguage,
    text: vocabularyWord.word,
  }).tokens;

  const promptPhrase = splitText({
    language: languages.language,
    text: vocabularyWord.translation,
  }).tokens;

  if (!hasLetters(phrase) || !hasLetters(promptPhrase)) {
    return [];
  }

  return sentence.tokens.flatMap((_token, start) => {
    const end = start + phrase.length;

    if (!startsAt({ phrase, start, tokens: sentence.tokens })) {
      return [];
    }

    const sentenceWords = trimPunctuation(joinSpan({ end, start, text: sentence }));

    return [
      {
        promptPhrase,
        sentenceEnd: end,
        sentenceKeys: phrase.map((token) => token.key),
        sentenceStart: start,
        sentenceWords,
      },
    ];
  });
}

/** A span the lesson lists twice keeps its first translation, as the word bank does. */
function isFirstAtSpan(hint: Hint, index: number, hints: Hint[]): boolean {
  return (
    hints.findIndex(
      (other) =>
        other.sentenceStart === hint.sentenceStart && other.sentenceEnd === hint.sentenceEnd,
    ) === index
  );
}

/** A longer phrase owns its words, so "new" can't show on "novo" when it's part of "New York". */
function isOwnSpan(hint: Hint, hints: Hint[]): boolean {
  return !hints.some((other) => overlaps(other, hint) && spanLength(other) > spanLength(hint));
}

function isUnambiguous(hint: Hint, hints: Hint[]): boolean {
  return hints.every(
    (other) =>
      !isSamePhrase(
        other.promptPhrase.map((token) => token.key),
        hint.promptPhrase.map((token) => token.key),
      ) || isSamePhrase(other.sentenceKeys, hint.sentenceKeys),
  );
}

function toSentenceHints({
  languages,
  prompt,
  sentence,
  vocabulary,
}: {
  languages: LessonLanguages;
  prompt: SplitText;
  sentence: string;
  vocabulary: VocabularyWord[];
}): Hint[] {
  const split = splitText({ language: languages.targetLanguage, text: sentence });

  const found = vocabulary
    .flatMap((vocabularyWord) => findInSentence({ languages, sentence: split, vocabularyWord }))
    .filter((hint, index, all) => isFirstAtSpan(hint, index, all))
    .filter((hint) => appearsIn({ phrase: hint.promptPhrase, text: prompt }));

  const owned = found
    .filter((hint) => isOwnSpan(hint, found))
    .toSorted((first, second) => first.sentenceStart - second.sentenceStart);

  return owned.filter((hint) => isUnambiguous(hint, owned));
}

function findLongestHint({
  hints,
  start,
  tokens,
  usedHints,
}: {
  hints: Hint[];
  start: number;
  tokens: Token[];
  usedHints: Hint[];
}): Hint | undefined {
  return hints
    .filter(
      (hint) =>
        !usedHints.some((used) => overlaps(used, hint)) &&
        startsAt({ phrase: hint.promptPhrase, start, tokens }),
    )
    .toSorted((first, second) => second.promptPhrase.length - first.promptPhrase.length)[0];
}

function matchPromptAt({
  hints,
  match,
  prompt,
  start,
}: {
  hints: Hint[];
  match: PromptMatch;
  prompt: SplitText;
  start: number;
}): PromptMatch {
  if (start < match.next) {
    return match;
  }

  const hint = findLongestHint({ hints, start, tokens: prompt.tokens, usedHints: match.usedHints });
  const end = start + (hint?.promptPhrase.length ?? 1);

  const promptWord = {
    translation: hint?.sentenceWords ?? null,
    word: joinSpan({ end, start, text: prompt }),
  };

  return {
    next: end,
    promptWords: [...match.promptWords, promptWord],
    usedHints: hint ? [...match.usedHints, hint] : match.usedHints,
  };
}

/**
 * The prompt is the sentence in the learner's language. A prompt word or phrase shows the sentence
 * words it translates when the lesson's vocabulary pairs them word for word on both sides, accents
 * included ("avó", "avô"), and nothing when two different sentence phrases share that translation:
 * a guessed pairing would teach a wrong meaning. Each sentence word and each prompt word belongs to
 * one hint at most, the longest phrase first.
 */
export function buildReadingPromptWords({
  languages,
  prompt,
  sentence,
  vocabulary,
}: {
  languages: LessonLanguages;
  prompt: string;
  sentence: string;
  vocabulary: VocabularyWord[];
}): ReadingPromptWord[] {
  const split = splitText({ language: languages.language, text: stripWrappingQuotes(prompt) });
  const hints = toSentenceHints({ languages, prompt: split, sentence, vocabulary });
  const initial: PromptMatch = { next: 0, promptWords: [], usedHints: [] };

  return split.words.reduce(
    (match, _word, start) => matchPromptAt({ hints, match, prompt: split, start }),
    initial,
  ).promptWords;
}
