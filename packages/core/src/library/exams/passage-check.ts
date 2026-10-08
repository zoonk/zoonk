/** Shorter quotes ("Sim", "2026") would match almost any document. */
const MIN_PASSAGE_LENGTH = 8;

/** PDF text breaks lines and words, so a passage may lose a few words and still be the same one. */
const MIN_WORD_SHARE = 0.9;

const WORD_PATTERN = /[\p{L}\p{N}]+/gu;
const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/gu;

function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("­", "")
    .replaceAll(/[‘’´`]/gu, "'")
    .replaceAll(/[“”«»]/gu, '"')
    .replaceAll(/[‐‑‒–—]/gu, "-")
    .replaceAll(/-\s*\n\s*/gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function toWords(text: string): string[] {
  return text.match(WORD_PATTERN) ?? [];
}

function toNumbers(text: string): string[] {
  return text.match(NUMBER_PATTERN) ?? [];
}

function sharesWordsAndNumbers({
  document,
  passage,
}: {
  document: string;
  passage: string;
}): boolean {
  const documentWords = new Set(toWords(document));
  const documentNumbers = new Set(toNumbers(document));
  const passageWords = toWords(passage);

  if (!toNumbers(passage).every((number) => documentNumbers.has(number))) {
    return false;
  }

  const found = passageWords.filter((word) => documentWords.has(word)).length;

  return passageWords.length > 0 && found / passageWords.length >= MIN_WORD_SHARE;
}

/**
 * Words in order with single spaces around them, so a name matches whole words only. A hyphen
 * inside a word joins its halves, since PDF text often loses it ("políticoadministrativa").
 */
function toWordLine(text: string): string {
  const joined = normalizeText(text).replaceAll(/(?<=\p{L})-(?=\p{L})/gu, "");
  return ` ${toWords(joined).join(" ")} `;
}

/**
 * The names a document states word for word, such as a syllabus's item names quoted as a
 * subject's topics: case, spacing, punctuation and PDF line breaks aside, every word in order.
 * Names are checked this way instead of by a model because a syllabus lists more of them than
 * any passage quotes.
 */
export function findNamesInDocument({
  names,
  text,
}: {
  names: readonly string[];
  text: string;
}): Set<string> {
  const document = toWordLine(text);

  return new Set(
    names.filter((name) => {
      const words = toWordLine(name);
      return words.trim().length > 0 && document.includes(words);
    }),
  );
}

/**
 * The code half of the citation check: the quoted passage must really be in
 * the document. A model can quote a sentence that isn't there, and a fact
 * with an invented passage is dropped before a second model checks the rest.
 * Every number in the passage must appear exactly, since numbers are what
 * learners plan with.
 */
export function isPassageInDocument({ passage, text }: { passage: string; text: string }): boolean {
  const normalizedPassage = normalizeText(passage);

  if (normalizedPassage.length < MIN_PASSAGE_LENGTH) {
    return false;
  }

  const normalizedDocument = normalizeText(text);

  return (
    normalizedDocument.includes(normalizedPassage) ||
    sharesWordsAndNumbers({ document: normalizedDocument, passage: normalizedPassage })
  );
}
