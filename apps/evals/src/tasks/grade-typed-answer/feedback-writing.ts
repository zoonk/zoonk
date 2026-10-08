const HTML_ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z]+);/iu;

/** Words quoted from the learner keep their spelling, so they're left out of the check. */
const QUOTED = /"[^"]*"|“[^”]*”|'[^']*'|‘[^’]*’|«[^»]*»/gu;

/** Portuguese words that are never written without their accent. */
const ACCENTED_WORDS = new Set([
  "alem",
  "apos",
  "ate",
  "entao",
  "estao",
  "ja",
  "nao",
  "numero",
  "porem",
  "possivel",
  "sao",
  "tambem",
  "tres",
  "voce",
  "voces",
]);

/** Endings that always carry an accent or cedilla: "-ção", "-ções", "-ência", "-ância". */
const UNACCENTED_ENDING = /(?:cao|coes|encia|ancia)$/u;

/**
 * Portuguese has no diaeresis since 2009, so "vocë" or "trës" is a botched "ê" (the model wrote
 * U+00EB, one code point off U+00EA).
 */
const DIAERESIS = /[äëïöü]/iu;

function isMisaccented(word: string): boolean {
  return (
    ACCENTED_WORDS.has(word) ||
    (word.length > 4 && UNACCENTED_ENDING.test(word)) ||
    DIAERESIS.test(word)
  );
}

function findMisaccentedWord(text: string): string | null {
  const words = text
    .replaceAll(QUOTED, " ")
    .toLowerCase()
    .split(/[^\p{L}]+/u);

  return words.find((word) => isMisaccented(word)) ?? null;
}

/**
 * What makes the grader's feedback unreadable as written, or null when it's fine: HTML entities
 * in any language, and Portuguese written without its accents or with the wrong ones (the learner
 * sees "nao", "voce", "vocë").
 */
export function findFeedbackWritingIssue({
  feedback,
  language,
}: {
  feedback: string | null;
  language: unknown;
}): string | null {
  if (!feedback) {
    return null;
  }

  if (HTML_ENTITY.test(feedback)) {
    return "HTML entity in the text";
  }

  const misaccented = language === "pt" ? findMisaccentedWord(feedback) : null;
  return misaccented ? `"${misaccented}" written without its right accent` : null;
}

/**
 * Openings that call the whole answer right ("Muito bem!", "Correct."): feedback that starts so
 * on an answer marked wrong tells the learner the opposite of the verdict.
 */
const PRAISE_OPENING =
  /^(?:muito bem|correto|certo|exatamente|perfeito|isso mesmo|otimo|excelente|parabens|well done|correct|exactly|perfect|great|excellent)\b/u;

/**
 * Feedback that praises an answer the grade marks wrong, or null when the feedback follows the
 * verdict.
 */
export function findPraiseMismatch({
  feedback,
  isCorrect,
}: {
  feedback: string | null;
  isCorrect: boolean;
}): string | null {
  if (!feedback || isCorrect) {
    return null;
  }

  const opening = feedback.normalize("NFD").replaceAll(/\p{M}/gu, "").trim().toLowerCase();
  return PRAISE_OPENING.test(opening) ? "praises an answer it marks wrong" : null;
}
