import { normalizeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { Converter as createChineseConverter } from "opencc-js/t2cn";
import { alignWords } from "./_utils/word-alignment";

/**
 * How one word of the expected sentence came out: said as expected, heard as
 * something else, or not heard at all.
 */
type SpokenWordStatus = "correct" | "different" | "missed";

export type SpokenWordResult = {
  /** The word as written in the expected sentence. */
  text: string;
  status: SpokenWordStatus;
  /** What we heard in its place; null when it was said as expected or not heard. */
  heard: string | null;
};

export type SpokenAnswerMatch = {
  words: SpokenWordResult[];
  /** Share of the expected words heard as expected, from 0 to 1. */
  score: number;
  /** Every expected word heard as expected. Extra words ("um") don't count against it. */
  isCorrect: boolean;
  /** The comparison and reuse key for what was heard. */
  normalizedHeard: string;
};

/** At most this many words get an explanation, so feedback stays short. */
const MAX_WORDS_TO_EXPLAIN = 2;

/**
 * Transcripts and sentences write English contractions both ways ("I've" and
 * "I have"), and both are right, so both are compared in their long form.
 * "'s" and "'d" stay, since each stands for more than one word.
 */
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

/**
 * Speech recognition writes Chinese in traditional or simplified characters either way
 * (gpt-transcribe wrote 圖書館 for 图书馆, 11 Oct 2026), so Chinese compares in simplified ones.
 */
const toSimplifiedChinese = createChineseConverter({ from: "t", to: "cn" });

/**
 * Languages written without spaces take their words from the language's word segmenter, so a
 * comma the transcript adds or leaves out doesn't merge or split words.
 */
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

/** How tokens join back into text: with spaces, or without them where the language has none. */
function getTokenSeparator(language: string): string {
  return getUnspacedSegmenter(language) ? "" : " ";
}

type ExpectedWord = { text: string; tokens: string[] };

/** Keeps each written word with its comparison tokens, so results show the sentence as written. */
function toExpectedWords({ expected, language }: { expected: string; language: string }) {
  return expected
    .split(/\s+/u)
    .map((text) => ({ text, tokens: toTokens({ language, text }) }))
    .filter((word): word is ExpectedWord => word.tokens.length > 0);
}

/** Whether an expected token was heard as itself, and which heard token stood in its place. */
type TokenOutcome = { heardIndex: number | null; matched: boolean };

/**
 * What each expected token came out as: itself, another heard token, or nothing. Steps come in
 * order, so a running position gives every match the heard token it lines up with.
 */
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

/**
 * A written word is right when every one of its tokens was heard as itself. Otherwise it shows
 * everything heard across its tokens, extra words in between included, so a sentence written
 * without spaces shows the whole stretch that was heard instead.
 */
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

/** Where each written word's tokens start in the flat token list. */
function getTokenOffsets(words: readonly ExpectedWord[]): number[] {
  return words.map((_, index) =>
    words.slice(0, index).reduce((total, word) => total + word.tokens.length, 0),
  );
}

/**
 * Compares what speech recognition heard with the sentence the learner was
 * asked to say, word by word. Case, punctuation, contractions and Chinese
 * script never make a word wrong; a different word or a missing one does. Used
 * for spoken answers and for typing a spoken step when the learner can't talk.
 */
export function matchSpokenAnswer({
  expected,
  heard,
  language,
}: {
  expected: string;
  heard: string;
  /** The language spoken: the step's target language. */
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

/**
 * The words worth explaining, at most two: words heard as something else
 * first, since they carry a pronunciation or form to fix, then missed ones.
 */
export function pickWordsToExplain(words: readonly SpokenWordResult[]): SpokenWordResult[] {
  const different = words.filter((word) => word.status === "different");
  const missed = words.filter((word) => word.status === "missed");

  return [...different, ...missed].slice(0, MAX_WORDS_TO_EXPLAIN);
}
