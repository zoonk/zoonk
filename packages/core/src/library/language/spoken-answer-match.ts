import { normalizeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { Converter as createChineseConverter } from "opencc-js/t2cn";
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

const ENGLISH_CONTRACTIONS: readonly [RegExp, string][] = [
  [/\bcan't\b/gu, "can not"],
  [/\bwon't\b/gu, "will not"],
  [/n't\b/gu, " not"],
  [/'re\b/gu, " are"],
  [/'ve\b/gu, " have"],
  [/'m\b/gu, " am"],
  [/'ll\b/gu, " will"],
];

function expandContractions({ language, text }: { language: string; text: string }): string {
  if (!language.startsWith("en")) {
    return text;
  }

  return ENGLISH_CONTRACTIONS.reduce(
    (expanded, [pattern, replacement]) => expanded.replaceAll(pattern, replacement),
    text,
  );
}

/** Speech recognition may return either Chinese script; compare in simplified characters. */
const toSimplifiedChinese = createChineseConverter({ from: "t", to: "cn" });

const UNSPACED_LANGUAGE_SEGMENTERS: Readonly<Record<string, Intl.Segmenter>> = {
  ja: new Intl.Segmenter("ja", { granularity: "word" }),
  zh: new Intl.Segmenter("zh", { granularity: "word" }),
};

function getUnspacedSegmenter(language: string): Intl.Segmenter | undefined {
  return UNSPACED_LANGUAGE_SEGMENTERS[getBaseLanguage(language)];
}

function toComparableScript({ language, text }: { language: string; text: string }): string {
  return getBaseLanguage(language) === "zh" ? toSimplifiedChinese(text) : text;
}

function toTokens({ language, text }: { language: string; text: string }): string[] {
  const normalized = expandContractions({
    language,
    text: normalizeTypedAnswer(toComparableScript({ language, text })),
  });

  const segmenter = getUnspacedSegmenter(language);

  if (segmenter) {
    return [...segmenter.segment(normalized)]
      .filter((segment) => segment.isWordLike)
      .map((segment) => segment.segment);
  }

  return normalized.split(" ").filter(Boolean);
}

function getTokenSeparator(language: string): string {
  return getUnspacedSegmenter(language) ? "" : " ";
}

type ExpectedWord = { text: string; tokens: string[] };

function toExpectedWords({ expected, language }: { expected: string; language: string }) {
  return expected
    .split(/\s+/u)
    .map((text) => ({ text, tokens: toTokens({ language, text }) }))
    .filter((word): word is ExpectedWord => word.tokens.length > 0);
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
    normalizedHeard: heardTokens.join(separator),
    score: words.length === 0 ? 0 : correctCount / words.length,
    words,
  };
}

export function pickWordsToExplain(words: readonly SpokenWordResult[]): SpokenWordResult[] {
  const different = words.filter((word) => word.status === "different");
  const missed = words.filter((word) => word.status === "missed");

  return [...different, ...missed].slice(0, MAX_WORDS_TO_EXPLAIN);
}
