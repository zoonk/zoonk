/** A single quote between two letters is an apostrophe ("I've"), never where a quote opens or closes. */
const QUOTED =
  /"[^"]*"|“[^”]*”|«[^»]*»|(?<!\p{L})'(?:[^']|(?<=\p{L})'(?=\p{L}))*'(?!\p{L})|‘(?:[^’]|(?<=\p{L})’(?=\p{L}))*’/gu;

const ACCENTED_WORDS = new Set([
  "alem",
  "apos",
  "ate",
  "ciencia",
  "competencia",
  "consequencia",
  "entao",
  "estao",
  "frequencia",
  "importancia",
  "ja",
  "nao",
  "numero",
  "porem",
  "possivel",
  "resistencia",
  "sao",
  "tambem",
  "tres",
  "voce",
  "voces",
]);

const UNACCENTED_ENDING = /(?:cao|coes)$/u;

const DIAERESIS = /[äëïöü]/iu;

function isMisaccented(word: string): boolean {
  return (
    ACCENTED_WORDS.has(word) ||
    (word.length > 4 && UNACCENTED_ENDING.test(word)) ||
    DIAERESIS.test(word)
  );
}

export function findMisaccentedPortugueseWord(text: string): string | null {
  const words = text
    .replaceAll(QUOTED, " ")
    .toLowerCase()
    .split(/[^\p{L}]+/u);

  return words.find((word) => isMisaccented(word)) ?? null;
}
