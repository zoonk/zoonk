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

type CheckedDocument = { normalized: string; numbers: Set<string>; words: Set<string> };

let lastChecked: { document: CheckedDocument; text: string } | null = null;

function checkedDocument(text: string): CheckedDocument {
  if (lastChecked?.text !== text) {
    const normalized = normalizeText(text);

    lastChecked = {
      document: {
        normalized,
        numbers: new Set(toNumbers(normalized)),
        words: new Set(toWords(normalized)),
      },
      text,
    };
  }

  return lastChecked.document;
}

function sharesWordsAndNumbers({
  document,
  passage,
}: {
  document: CheckedDocument;
  passage: string;
}): boolean {
  const passageWords = toWords(passage);

  if (!toNumbers(passage).every((number) => document.numbers.has(number))) {
    return false;
  }

  const found = passageWords.filter((word) => document.words.has(word)).length;

  return passageWords.length > 0 && found / passageWords.length >= MIN_WORD_SHARE;
}

function toWordLine(text: string): string {
  const joined = normalizeText(text).replaceAll(/(?<=\p{L})-(?=\p{L})/gu, "");
  return ` ${toWords(joined).join(" ")} `;
}

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

export function isPassageInDocument({ passage, text }: { passage: string; text: string }): boolean {
  const normalizedPassage = normalizeText(passage);

  if (normalizedPassage.length < MIN_PASSAGE_LENGTH) {
    return false;
  }

  const document = checkedDocument(text);

  return (
    document.normalized.includes(normalizedPassage) ||
    sharesWordsAndNumbers({ document, passage: normalizedPassage })
  );
}
