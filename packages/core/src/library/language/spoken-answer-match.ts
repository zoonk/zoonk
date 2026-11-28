import { normalizeTypedAnswer } from "@zoonk/ai/tasks/grading/typed-answer-match";
import { getBaseLanguage } from "@zoonk/utils/languages";
import {
  expandContractions,
  isSameSpokenWord,
  joinContractions,
} from "./_utils/english-contractions";
import { toSimplifiedChinese } from "./_utils/simplified-chinese";
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
// Keep the threshold below the 450 ms startup observed when Safari with AirPods clipped the opening.
const MISSED_START_MIN_MIC_STARTUP_MS = 400;
// A quick word like "a" takes about this long to say, which bounds how many words a late start can hide.
const SHORTEST_WORD_MS = 200;
const LONE_LETTER = /^\p{L}\p{M}*$/u;
const DIGIT_GROUP = /^\p{Nd}+$/u;

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

  for (const step of alignWords({ expected, heard, isSameWord: isSameSpokenWord })) {
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

  const heard = joinContractions(
    heardTokens.slice(Math.min(...heardIndexes), Math.max(...heardIndexes) + 1).join(separator),
  );

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
  const expectedWords = toExpectedWords({ expected, language });
  const heardTokens = toTokens({ language, text: heard });

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
    normalizedHeard: joinContractions(heardTokens.join(separator)),
    score: words.length === 0 ? 0 : correctCount / words.length,
    words,
  };
}

export function pickWordsToExplain(words: readonly SpokenWordResult[]): SpokenWordResult[] {
  const different = words.filter((word) => word.status === "different");
  const missed = words.filter((word) => word.status === "missed");

  return [...different, ...missed].slice(0, MAX_WORDS_TO_EXPLAIN);
}

export function hasMissedStart({
  micStartupMs,
  words,
}: {
  micStartupMs?: number;
  words: readonly SpokenWordResult[];
}): boolean {
  if (micStartupMs === undefined || micStartupMs < MISSED_START_MIN_MIC_STARTUP_MS) {
    return false;
  }

  const firstCorrect = words.findIndex((word) => word.status === "correct");

  return (
    firstCorrect > 0 &&
    firstCorrect <= Math.floor(micStartupMs / SHORTEST_WORD_MS) &&
    words.slice(firstCorrect).every((word) => word.status === "correct")
  );
}
