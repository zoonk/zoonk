import { normalizeTypedAnswer } from "@zoonk/ai/tasks/grading/typed-answer-match";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { Converter as createChineseConverter } from "opencc-js/t2cn";
import { expandAmbiguousContractions, expandContractions } from "./_utils/english-contractions";
import { alignWords } from "./_utils/word-alignment";

type SpokenWordStatus = "correct" | "different" | "missed";

export type SpokenWordResult = { text: string; status: SpokenWordStatus; heard: string | null };

export type SpokenAnswerMatch = {
  words: SpokenWordResult[];
  score: number;
  isCorrect: boolean;
  normalizedHeard: string;
};

const MAX_WORDS_TO_EXPLAIN = 2;
const LONE_LETTER = /^\p{L}\p{M}*$/u;
const DIGIT_RUN = /\p{Nd}+/gu;
const DIGIT_GROUP = /^\p{Nd}+$/u;

/** Speech recognition may return either Chinese script; compare in simplified characters. */
const toSimplifiedChinese = createChineseConverter({ from: "t", to: "cn" });

const CHINESE_SCRIPT_LANGUAGES: ReadonlySet<string> = new Set(["yue", "zh"]);

const UNSPACED_LANGUAGE_SEGMENTERS: Readonly<Record<string, Intl.Segmenter>> = {
  ja: new Intl.Segmenter("ja", { granularity: "word" }),
  yue: new Intl.Segmenter("yue", { granularity: "word" }),
  zh: new Intl.Segmenter("zh", { granularity: "word" }),
};

function getUnspacedSegmenter(language: string): Intl.Segmenter | undefined {
  return UNSPACED_LANGUAGE_SEGMENTERS[getBaseLanguage(language)];
}

function toComparableScript({ language, text }: { language: string; text: string }): string {
  return CHINESE_SCRIPT_LANGUAGES.has(getBaseLanguage(language)) ? toSimplifiedChinese(text) : text;
}

function isLoneLetter(token: string): boolean {
  return LONE_LETTER.test(token);
}

function splitSpelledOut(token: string): string[] {
  const parts = token.split("-");

  const isSpelledOut =
    parts.length > 1 &&
    (parts.every((part) => isLoneLetter(part)) || parts.every((part) => DIGIT_GROUP.test(part)));

  return isSpelledOut ? parts : [token];
}

function toTokens({ language, text }: { language: string; text: string }): string[] {
  const normalized = expandContractions({
    language,
    text: normalizeTypedAnswer(toComparableScript({ language, text }), getBaseLanguage(language)),
  });

  const segmenter = getUnspacedSegmenter(language);

  if (segmenter) {
    return [...segmenter.segment(normalized)]
      .filter((segment) => segment.isWordLike)
      .map((segment) => segment.segment);
  }

  return normalized
    .split(" ")
    .filter(Boolean)
    .flatMap((token) => splitSpelledOut(token));
}

function getTokenSeparator(language: string): string {
  return getUnspacedSegmenter(language) ? "" : " ";
}

type ExpectedWord = { text: string; tokens: readonly string[] };

function toExpectedWords({
  expected,
  language,
}: {
  expected: string;
  language: string;
}): ExpectedWord[] {
  return expected
    .split(/\s+/u)
    .map((text) => ({ text, tokens: toTokens({ language, text }) }))
    .filter((word) => word.tokens.length > 0);
}

type TokenOutcome = { heardIndex: number | null; matched: boolean };

function getTokenOutcomes({
  expected,
  heard,
}: {
  expected: readonly string[];
  heard: readonly string[];
}): TokenOutcome[] {
  const outcomes = new Map<number, TokenOutcome>();
  let heardIndex = 0;

  for (const step of alignWords(expected, heard)) {
    if (step.kind === "match") {
      outcomes.set(step.expected, { heardIndex, matched: true });
      heardIndex += 1;
    } else if (step.kind === "substitute") {
      outcomes.set(step.expected, { heardIndex: step.heard, matched: false });
      heardIndex = step.heard + 1;
    } else if (step.kind === "insert") {
      heardIndex = step.heard + 1;
    } else {
      outcomes.set(step.expected, { heardIndex: null, matched: false });
    }
  }

  return expected.map((_, index) => outcomes.get(index) ?? { heardIndex: null, matched: false });
}

function toWordResult({
  heardTokens,
  outcomes,
  separator,
  word,
}: {
  heardTokens: readonly string[];
  outcomes: readonly TokenOutcome[];
  separator: string;
  word: ExpectedWord;
}): SpokenWordResult {
  if (outcomes.every((outcome) => outcome.matched)) {
    return { heard: null, status: "correct", text: word.text };
  }

  const heardIndexes = outcomes.flatMap((outcome) =>
    outcome.heardIndex === null ? [] : [outcome.heardIndex],
  );

  if (heardIndexes.length === 0) {
    return { heard: null, status: "missed", text: word.text };
  }

  const heard = heardTokens
    .slice(Math.min(...heardIndexes), Math.max(...heardIndexes) + 1)
    .join(separator);

  return { heard, status: "different", text: word.text };
}

function getTokenOffsets(words: readonly ExpectedWord[]): number[] {
  return words.map((_, index) =>
    words.slice(0, index).reduce((total, word) => total + word.tokens.length, 0),
  );
}

export function matchSpokenAnswer({
  expected,
  heard,
  language,
}: {
  expected: string;
  heard: string;
  language: string;
}): SpokenAnswerMatch {
  const writtenWords = toExpectedWords({ expected, language });
  const writtenHeard = toTokens({ language, text: heard });

  const texts = [writtenWords.flatMap((word) => word.tokens), writtenHeard];

  const expectedWords = writtenWords.map((word) => ({
    ...word,
    tokens: expandAmbiguousContractions({ language, texts, tokens: word.tokens }),
  }));

  const heardTokens = expandAmbiguousContractions({ language, texts, tokens: writtenHeard });

  const outcomes = getTokenOutcomes({
    expected: expectedWords.flatMap((word) => word.tokens),
    heard: heardTokens,
  });

  const offsets = getTokenOffsets(expectedWords);
  const separator = getTokenSeparator(language);

  const words = expectedWords.map((word, index) => {
    const offset = offsets[index] ?? 0;

    return toWordResult({
      heardTokens,
      outcomes: outcomes.slice(offset, offset + word.tokens.length),
      separator,
      word,
    });
  });

  const correctCount = words.filter((word) => word.status === "correct").length;

  return {
    isCorrect: words.length > 0 && correctCount === words.length,
    normalizedHeard: heardTokens.join(separator),
    score: words.length === 0 ? 0 : correctCount / words.length,
    words,
  };
}

function isWrittenAsLetters({ language, text }: { language: string; text: string }): boolean {
  return toTokens({ language, text }).every((token) => isLoneLetter(token));
}

/** A letter's name can take two words ("double u", "i griega"), so a mistake beside it may be the rest. */
function isLetterNameHeardAsLetters({
  index,
  language,
  words,
}: {
  index: number;
  language: string;
  words: readonly SpokenWordResult[];
}): boolean {
  const word = words[index];

  if (
    word?.status !== "different" ||
    word.heard === null ||
    !word.heard.split(" ").every((token) => isLoneLetter(token))
  ) {
    return false;
  }

  const name = [words[index - 1], word, words[index + 1]].filter(
    (part): part is SpokenWordResult => part !== undefined && part.status !== "correct",
  );

  return name.some((part) => !isWrittenAsLetters({ language, text: part.text }));
}

function hasTranscribedLetterNames({
  language,
  words,
}: {
  language: string;
  words: readonly SpokenWordResult[];
}): boolean {
  // A Chinese or Japanese character heard alone is usually a whole word, not a letter.
  if (getUnspacedSegmenter(language)) {
    return false;
  }

  return words.some((_, index) => isLetterNameHeardAsLetters({ index, language, words }));
}

function toDigitRuns(text: string): string {
  return [...text.matchAll(DIGIT_RUN)].join(" ");
}

function isNumberWrittenOtherwise(word: SpokenWordResult): boolean {
  return word.status !== "correct" && toDigitRuns(word.text) !== toDigitRuns(word.heard ?? "");
}

/**
 * A transcriber writes a letter said by its name as the bare letter ("M" for "emme"), and a number
 * as digits or words whichever way the sentence doesn't ("3" for "three", "two three four" for
 * "234"), so its transcript can't tell whether those were said right. The word-by-word check,
 * which hears the recording against the sentence, can.
 */
export function needsWordByWordCheck({
  language,
  words,
}: {
  language: string;
  words: readonly SpokenWordResult[];
}): boolean {
  return (
    words.some((word) => isNumberWrittenOtherwise(word)) ||
    hasTranscribedLetterNames({ language, words })
  );
}

export function pickWordsToExplain(words: readonly SpokenWordResult[]): SpokenWordResult[] {
  const different = words.filter((word) => word.status === "different");
  const missed = words.filter((word) => word.status === "missed");

  return [...different, ...missed].slice(0, MAX_WORDS_TO_EXPLAIN);
}
