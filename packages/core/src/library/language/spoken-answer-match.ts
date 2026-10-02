import { normalizeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { type AlignmentStep, alignWords } from "./_utils/word-alignment";

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

function toTokens({ language, text }: { language: string; text: string }): string[] {
  const normalized = expandContractions({ language, text: normalizeTypedAnswer(text) });
  return normalized.split(" ").filter(Boolean);
}

type ExpectedWord = { text: string; tokens: string[] };

/** Keeps each written word with its comparison tokens, so results show the sentence as written. */
function toExpectedWords({ expected, language }: { expected: string; language: string }) {
  return expected
    .split(/\s+/u)
    .map((text) => ({ text, tokens: toTokens({ language, text }) }))
    .filter((word): word is ExpectedWord => word.tokens.length > 0);
}

type TokenOutcome = { heard: string | null; matched: boolean };

function toTokenOutcome({
  expected,
  heard,
  step,
}: {
  expected: readonly string[];
  heard: readonly string[];
  step: AlignmentStep;
}): [number, TokenOutcome][] {
  if (step.kind === "match") {
    return [[step.expected, { heard: expected[step.expected] ?? null, matched: true }]];
  }

  if (step.kind === "substitute") {
    return [[step.expected, { heard: heard[step.heard] ?? null, matched: false }]];
  }

  return step.kind === "delete" ? [[step.expected, { heard: null, matched: false }]] : [];
}

/** What each expected token came out as: itself, another heard token, or nothing. */
function getTokenOutcomes({
  expected,
  heard,
}: {
  expected: readonly string[];
  heard: readonly string[];
}): TokenOutcome[] {
  const outcomes = new Map(
    alignWords(expected, heard).flatMap((step) => toTokenOutcome({ expected, heard, step })),
  );

  return expected.map((_, index) => outcomes.get(index) ?? { heard: null, matched: false });
}

function toWordResult({
  outcomes,
  word,
}: {
  outcomes: readonly TokenOutcome[];
  word: ExpectedWord;
}): SpokenWordResult {
  if (outcomes.every((outcome) => outcome.matched)) {
    return { heard: null, status: "correct", text: word.text };
  }

  const heardTokens = outcomes.flatMap((outcome) => (outcome.heard ? [outcome.heard] : []));

  if (heardTokens.length === 0) {
    return { heard: null, status: "missed", text: word.text };
  }

  return { heard: heardTokens.join(" "), status: "different", text: word.text };
}

/** Where each written word's tokens start in the flat token list. */
function getTokenOffsets(words: readonly ExpectedWord[]): number[] {
  return words.map((_, index) =>
    words.slice(0, index).reduce((total, word) => total + word.tokens.length, 0),
  );
}

/**
 * Compares what speech recognition heard with the sentence the learner was
 * asked to say, word by word. Case, punctuation and contractions never make a
 * word wrong; a different word or a missing one does. Used for spoken answers
 * and for typing a spoken step when the learner can't talk.
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

  const words = expectedWords.map((word, index) => {
    const offset = offsets[index] ?? 0;
    return toWordResult({ outcomes: outcomes.slice(offset, offset + word.tokens.length), word });
  });

  const correctCount = words.filter((word) => word.status === "correct").length;

  return {
    isCorrect: words.length > 0 && correctCount === words.length,
    normalizedHeard: heardTokens.join(" "),
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
