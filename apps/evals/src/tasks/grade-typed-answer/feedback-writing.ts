const HTML_ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z]+);/iu;

/** A single quote between two letters is an apostrophe ("I've"), never where a quote opens or closes. */
const QUOTED =
  /"[^"]*"|“[^”]*”|«[^»]*»|(?<!\p{L})'(?:[^']|(?<=\p{L})'(?=\p{L}))*'(?!\p{L})|‘(?:[^’]|(?<=\p{L})’(?=\p{L}))*’/gu;

/** Portuguese dropped the diaeresis in 2009 ("tranquilo", not "tranqüilo"). */
const DIAERESIS = /[äëïöü]/iu;

function findDiaeresisWord(text: string): string | null {
  const words = text.replaceAll(QUOTED, " ").split(/[^\p{L}]+/u);
  return words.find((word) => DIAERESIS.test(word)) ?? null;
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

  const diaeresis = language === "pt" ? findDiaeresisWord(feedback) : null;
  return diaeresis ? `"${diaeresis}" written with a diaeresis Portuguese no longer uses` : null;
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
