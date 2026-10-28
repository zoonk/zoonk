const HTML_ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z]+);/iu;

const QUOTED = /"[^"]*"|“[^”]*”|'[^']*'|‘[^’]*’|«[^»]*»/gu;

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

const UNACCENTED_ENDING = /(?:cao|coes|encia|ancia)$/u;

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

const PRAISE_OPENING =
  /^(?:muito bem|correto|certo|exatamente|perfeito|isso mesmo|otimo|excelente|parabens|well done|correct|exactly|perfect|great|excellent)\b/u;

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
