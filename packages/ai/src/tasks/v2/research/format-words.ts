/** Shorter words ("de", "the", "uma") say nothing about what a question asks. */
const MIN_WORD_LENGTH = 4;

/** Words every format's description has, in the languages notes are written in: they tell none apart. */
const FORMAT_FILLER = new Set([
  "about",
  "aufgabe",
  "entre",
  "frage",
  "fragen",
  "para",
  "pregunta",
  "preguntas",
  "prova",
  "question",
  "questions",
  "questao",
  "questoes",
  "sobre",
  "teste",
  "uber",
  "with",
]);

function toWords(text: string): Set<string> {
  return new Set(
    text
      .normalize("NFD")
      .replaceAll(/\p{M}/gu, "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= MIN_WORD_LENGTH && !FORMAT_FILLER.has(word)),
  );
}

/** Whether two formats' descriptions ask about the same thing: they share a word that says what. */
function sharesWords(first: string, second: string): boolean {
  const words = toWords(first);
  return [...toWords(second)].some((word) => words.has(word));
}

type DescribedFormat = { description: string; kind: string };

/**
 * The same question format, read twice: one kind (or one read as `other`, which the other names)
 * asking about the same thing ("tabela das organelas" in both).
 */
export function isSameFormat(first: DescribedFormat, second: DescribedFormat): boolean {
  const sameKind = first.kind === second.kind || first.kind === "other" || second.kind === "other";

  return sameKind && sharesWords(first.description, second.description);
}
