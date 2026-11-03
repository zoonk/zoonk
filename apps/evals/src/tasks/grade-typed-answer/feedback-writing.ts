import { findMisaccentedPortugueseWord } from "@/lib/portuguese-accents";

const HTML_ENTITY = /&(?:#\d+|#x[\da-f]+|[a-z]+);/iu;

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

  const misaccented = language === "pt" ? findMisaccentedPortugueseWord(feedback) : null;
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
