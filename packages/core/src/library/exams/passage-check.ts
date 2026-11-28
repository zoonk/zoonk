const MIN_PASSAGE_LENGTH = 8;

/** PDF text breaks lines and words, so a passage may lose a few words and still be the same one. */
const MIN_WORD_SHARE = 0.9;

const WORD_PATTERN = /[\p{L}\p{N}]+/gu;
const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/gu;

/** Normalized text that keeps the page's line breaks, a table row or a list item per line. */
function normalizeLines(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("­", "")
    .replaceAll(/[‘’´`]/gu, "'")
    .replaceAll(/[“”«»]/gu, '"')
    .replaceAll(/[‐‑‒–—]/gu, "-")
    .replaceAll(/-\s*\n\s*/gu, "")
    .replaceAll(/[^\S\n]+/gu, " ")
    .replaceAll(/\s*\n\s*/gu, "\n")
    .trim();
}

function normalizeText(text: string): string {
  return normalizeLines(text).replaceAll("\n", " ");
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

function joinHyphenatedWords(text: string): string {
  return normalizeLines(text).replaceAll(/(?<=\p{L})-(?=\p{L})/gu, "");
}

function toWordLine(text: string): string {
  return ` ${toWords(joinHyphenatedWords(text)).join(" ")} `;
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

function isLongEnough(normalizedPassage: string): boolean {
  return normalizedPassage.length >= MIN_PASSAGE_LENGTH;
}

type Span = { end: number; start: number };
type NameAt = Span & { name: string };

function findNameAt({ name, text }: { name: string; text: string }): NameAt[] {
  const words = toWords(joinHyphenatedWords(name));

  if (words.length === 0) {
    return [];
  }

  const pattern = new RegExp(
    String.raw`(?<![\p{L}\p{N}])${words.join(String.raw`[^\p{L}\p{N}]+`)}(?![\p{L}\p{N}])`,
    "gu",
  );

  return [...text.matchAll(pattern)].map((match) => ({
    end: match.index + match[0].length,
    name,
    start: match.index,
  }));
}

function isInsideLonger(found: NameAt, all: readonly NameAt[]): boolean {
  return all.some(
    (other) =>
      other !== found &&
      other.start <= found.start &&
      found.end <= other.end &&
      other.end - other.start > found.end - found.start,
  );
}

/**
 * Each name the page holds with what follows it up to the next name: a table row or a list item, the
 * way specifications print a heading and then its number. A name inside a longer one ("Algebra" in
 * "Advanced Algebra") doesn't start an entry.
 */
function splitAtNames({ names, page }: { names: readonly string[]; page: string }): NameAt[] {
  const found = names.flatMap((name) => findNameAt({ name, text: page }));

  const cuts = found
    .filter((item) => !isInsideLonger(item, found))
    .toSorted((first, second) => first.start - second.start);

  return cuts.map((cut, index) => ({
    end: cuts[index + 1]?.start ?? page.length,
    name: cut.name,
    start: cut.start,
  }));
}

type WordAt = Span & { word: string };

function toWordsAt(text: string): WordAt[] {
  return [...text.matchAll(WORD_PATTERN)].map((match) => ({
    end: match.index + match[0].length,
    start: match.index,
    word: match[0],
  }));
}

/**
 * Where the passage's words, from the page's word `from`, end. Words the quote skips (cells,
 * "…") must sit on the line of the words around them; adjacent words may wrap to the next line.
 */
function findSpanEnd({
  from,
  page,
  pageWords,
  words,
}: {
  from: number;
  page: string;
  pageWords: readonly WordAt[];
  words: readonly string[];
}): number | null {
  let matched = 0;
  let last = from;

  for (let index = from; index < pageWords.length; index += 1) {
    const at = pageWords[index];
    const previous = pageWords[last];

    if (!at || !previous) {
      return null;
    }

    if (index - last > 1 && page.slice(previous.end, at.start).includes("\n")) {
      return null;
    }

    if (at.word === words[matched]) {
      matched += 1;
      last = index;
    }

    if (matched === words.length) {
      return at.end;
    }
  }

  return null;
}

/** Every stretch of the page holding a passage's words in order. */
function findPassageSpans({ page, passage }: { page: string; passage: string }): Span[] {
  const words = toWords(joinHyphenatedWords(passage));

  if (words.length === 0 || !isLongEnough(normalizeText(passage))) {
    return [];
  }

  const pageWords = toWordsAt(page);

  return pageWords.flatMap((at, from) => {
    const end = at.word === words[0] ? findSpanEnd({ from, page, pageWords, words }) : null;
    return end === null ? [] : [{ end, start: at.start }];
  });
}

/**
 * The entries, normalized, that start inside a stretch of the page holding the passage, each a name
 * and the page's text after it up to the next name or the stretch's end. What sits beside a name is
 * read from the page, never from the quote, so a number the page prints beside another name can't
 * become this one's.
 */
export function findQuotedEntries({
  names,
  passage,
  text,
}: {
  names: readonly string[];
  passage: string;
  text: string;
}): { entry: string; name: string }[] {
  const page = joinHyphenatedWords(text);
  const spans = findPassageSpans({ page, passage });
  const entries = spans.length > 0 ? splitAtNames({ names, page }) : [];

  return spans.flatMap((span) =>
    entries
      .filter((entry) => span.start <= entry.start && entry.start < span.end)
      .map((entry) => ({
        entry: page.slice(entry.start, Math.min(entry.end, span.end)),
        name: entry.name,
      })),
  );
}

/**
 * Word for word after normalizing, for claims a near match could fake (a date, a release's name):
 * the word-share fallback of `isPassageInDocument` would pass a passage with one word swapped.
 */
export function isPassageExactlyInDocument({
  passage,
  text,
}: {
  passage: string;
  text: string;
}): boolean {
  const normalizedPassage = normalizeText(passage);

  return (
    isLongEnough(normalizedPassage) && checkedDocument(text).normalized.includes(normalizedPassage)
  );
}

/**
 * The page's own whole lines around each place it holds the passage, so a quote cropped from a line
 * or with a line break where the page has a space is judged by the line it came from.
 */
export function findPassageLines({ passage, text }: { passage: string; text: string }): string[] {
  const target = normalizeText(passage);
  const lines = text.split("\n");

  const holds = (start: number, end: number) =>
    normalizeText(lines.slice(start, end + 1).join("\n")).includes(target);

  return lines.flatMap((line, start) => {
    const limit = normalizeText(line).length + target.length;

    for (let end = start; end < lines.length; end += 1) {
      if (holds(start, end)) {
        return end > start && holds(start + 1, end) ? [] : [lines.slice(start, end + 1).join("\n")];
      }

      if (normalizeText(lines.slice(start, end + 1).join("\n")).length > limit) {
        return [];
      }
    }

    return [];
  });
}

export function isPassageInDocument({ passage, text }: { passage: string; text: string }): boolean {
  const normalizedPassage = normalizeText(passage);

  return (
    isPassageExactlyInDocument({ passage, text }) ||
    (isLongEnough(normalizedPassage) &&
      sharesWordsAndNumbers({ document: checkedDocument(text), passage: normalizedPassage }))
  );
}
