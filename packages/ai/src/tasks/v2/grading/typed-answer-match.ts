import { removeAccents } from "@zoonk/utils/string";

const APOSTROPHES = /[’‘`´]/gu;
const DECIMAL_SEPARATOR = /(?<=\d),(?=\d)/gu;
const SYMBOLS = /[^\p{L}\p{N}\p{M}\s'.-]/gu;
const STRAY_PERIOD = /\.(?!\d)/gu;
const LOOSE_CONNECTORS = /(?<=^|\s)['-]+(?=\s|$)/gu;
const WHITESPACE = /\s+/gu;
const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u;
const DIGIT = /\d/u;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Below this length a one-letter change is usually a different word ("cat" and "car"). */
const MIN_LENGTH_FOR_ONE_TYPO = 4;
const MIN_LENGTH_FOR_TWO_TYPOS = 8;

export type TypedAnswerMatch =
  | { kind: "exact" | "typo"; acceptedAnswer: string }
  | { kind: "none"; acceptedAnswer: null };

/**
 * The comparison and reuse key for a typed answer. Case, spacing, quotes and
 * sentence punctuation never change what a learner meant, so "Paris." and
 * " paris" share one key. Accents stay because they change words in several
 * languages ("e" and "é" in Portuguese), and a decimal comma becomes a point so
 * "1,5" and "1.5" match.
 */
export function normalizeTypedAnswer(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replaceAll(APOSTROPHES, "'")
    .replaceAll(DECIMAL_SEPARATOR, ".")
    .replaceAll(SYMBOLS, " ")
    .replaceAll(STRAY_PERIOD, " ")
    .replaceAll(LOOSE_CONNECTORS, " ")
    .replaceAll(WHITESPACE, " ")
    .trim();
}

function parseNumber(normalized: string): number | null {
  return NUMBER.test(normalized) ? Number(normalized) : null;
}

function getAllowedTypos(length: number): number {
  if (length >= MIN_LENGTH_FOR_TWO_TYPOS) {
    return 2;
  }

  return length >= MIN_LENGTH_FOR_ONE_TYPO ? 1 : 0;
}

function getCell(rows: number[][], row: number, column: number): number {
  return rows[row]?.[column] ?? Number.POSITIVE_INFINITY;
}

/** Letters as a reader sees them, so an accented letter or emoji counts as one. */
function toGraphemes(text: string): string[] {
  return Array.from(graphemes.segment(text), (segment) => segment.segment);
}

/**
 * Optimal string alignment distance: insertions, deletions, substitutions and
 * swaps of two neighboring letters ("teh" for "the") each count once.
 */
function getEditDistance(source: string, target: string): number {
  const from = toGraphemes(source);
  const to = toGraphemes(target);

  const rows = Array.from({ length: from.length + 1 }, (_, row) =>
    Array.from({ length: to.length + 1 }, (__, column) => Math.max(row, column)),
  );

  for (let row = 1; row <= from.length; row += 1) {
    for (let column = 1; column <= to.length; column += 1) {
      const cost = from[row - 1] === to[column - 1] ? 0 : 1;

      const isSwap =
        row > 1 &&
        column > 1 &&
        from[row - 1] === to[column - 2] &&
        from[row - 2] === to[column - 1];

      const best = Math.min(
        getCell(rows, row - 1, column) + 1,
        getCell(rows, row, column - 1) + 1,
        getCell(rows, row - 1, column - 1) + cost,
        isSwap ? getCell(rows, row - 2, column - 2) + 1 : Number.POSITIVE_INFINITY,
      );

      rows[row]?.splice(column, 1, best);
    }
  }

  return getCell(rows, from.length, to.length);
}

/**
 * Numbers never count as typos ("1985" and "1986" are different answers), so
 * only answers without digits get a spelling allowance.
 */
function isTypo(answer: string, accepted: string): boolean {
  if (DIGIT.test(answer) || DIGIT.test(accepted)) {
    return false;
  }

  const plainAnswer = removeAccents(answer);
  const plainAccepted = removeAccents(accepted);

  if (plainAnswer === plainAccepted) {
    return true;
  }

  const allowed = getAllowedTypos(Math.min(plainAnswer.length, plainAccepted.length));

  return allowed > 0 && getEditDistance(plainAnswer, plainAccepted) <= allowed;
}

function isExact(answer: string, accepted: string): boolean {
  if (answer === accepted) {
    return true;
  }

  const answerNumber = parseNumber(answer);
  const acceptedNumber = parseNumber(accepted);

  return answerNumber !== null && answerNumber === acceptedNumber;
}

/**
 * Checks a typed answer against the accepted answers in code, so easy cases
 * never wait for a model: "exact" means the same answer written differently,
 * "typo" a spelling slip or missing accent the caller may accept with a note.
 */
export function matchTypedAnswer({
  acceptedAnswers,
  answer,
}: {
  acceptedAnswers: readonly string[];
  answer: string;
}): TypedAnswerMatch {
  const normalizedAnswer = normalizeTypedAnswer(answer);

  if (!normalizedAnswer) {
    return { acceptedAnswer: null, kind: "none" };
  }

  const candidates = acceptedAnswers
    .map((accepted) => ({ accepted, normalized: normalizeTypedAnswer(accepted) }))
    .filter((candidate) => candidate.normalized.length > 0);

  const exact = candidates.find((candidate) => isExact(normalizedAnswer, candidate.normalized));

  if (exact) {
    return { acceptedAnswer: exact.accepted, kind: "exact" };
  }

  const typo = candidates.find((candidate) => isTypo(normalizedAnswer, candidate.normalized));

  if (typo) {
    return { acceptedAnswer: typo.accepted, kind: "typo" };
  }

  return { acceptedAnswer: null, kind: "none" };
}
