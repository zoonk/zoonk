const MIN_MONTH_PREFIX = 3;
const MONTHS = 12;
/** Any year: only the month names and a date's words are read. */
const NAMING_YEAR = 2000;
const TOKEN = /\p{L}+|\p{N}+/gu;
const SHORT_NUMBER = /^\d{1,2}$/u;
/** Ordinals and the words pages write inside a date beyond `Intl`'s formats ("the 4th of May", "1er mai"). */
const DATE_WORDS = ["er", "nd", "of", "rd", "st", "th"];
/** A space, a comma or a period between a named month's date parts, or a slash or hyphen alone. */
const NAMED_JOINER = /^(?:[.,]?[ \t\u00A0\u202F]*|[/-])$/u;
/** "2025-10-21", "21/10/2025" and "21.10.2025"; a space alone joins no numeric date. */
const NUMERIC_JOINER = /^[./-]$/u;
const VERSION_SEPARATOR = /[\p{L}\p{N}][._-][\p{L}\p{N}]/u;
const RELEASE_WORDS = "release|version|versão|versión";
const RELEASE_WORD = new RegExp(String.raw`(?:^|[^\p{L}\p{N}])(?:${RELEASE_WORDS})$`, "iu");

/**
 * What may come before a version that opens its line: list or table marks, a label naming a
 * release ("Next release:", "Release anterior:") and a release word ("Release 4.2").
 */
const LINE_OPENING = new RegExp(
  String.raw`^[^\p{L}\p{N}]*(?:(?:(?:${RELEASE_WORDS})(?:\s+\p{L}+)?|\p{L}+\s+(?:${RELEASE_WORDS}))\s*:[^\p{L}\p{N}]*)?(?:(?:${RELEASE_WORDS})[^\p{L}\p{N}]*)?$`,
  "iu",
);

const TRAILING_MARKS = /[^\p{L}\p{N}]+$/u;
const LEADING_SPACE = /^\s+/u;
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

type Token = { end: number; start: number; text: string };

function toTokens(text: string): Token[] {
  return [...text.matchAll(TOKEN)].map((match) => ({
    end: match.index + match[0].length,
    start: match.index,
    text: match[0],
  }));
}

function toKey(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

function listMonthNames(language: string): string[] {
  const format = new Intl.DateTimeFormat(language, { month: "long", timeZone: "UTC" });

  return Array.from({ length: MONTHS }, (_, index) =>
    toKey(format.format(new Date(Date.UTC(NAMING_YEAR, index, 1)))),
  );
}

/** The words a language writes between a date's parts: "de" in "4 de maio de 2024", "年" and "月". */
function listDateWords(language: string): Set<string> {
  const date = new Date(Date.UTC(NAMING_YEAR, 0, 1));

  const words = (["long", "short", "numeric"] as const).flatMap((month) =>
    new Intl.DateTimeFormat(language, { day: "numeric", month, timeZone: "UTC", year: "numeric" })
      .formatToParts(date)
      .filter((part) => part.type === "literal")
      .flatMap((part) => toTokens(toKey(part.value)).map((token) => token.text)),
  );

  return new Set([...DATE_WORDS, ...words]);
}

/** A month's long name, or an abbreviation no other month's name starts with ("oct", "sept"). */
function isMonthName({ month, names, token }: { month: number; names: string[]; token: string }) {
  if (token.length < MIN_MONTH_PREFIX) {
    return false;
  }

  const matches = names.flatMap((name, index) => (name.startsWith(token) ? [index + 1] : []));
  return matches.length === 1 && matches[0] === month;
}

function isShortNumber({ token, value }: { token: string; value: number }): boolean {
  return SHORT_NUMBER.test(token) && Number(token) === value;
}

type Passage = { names: string[]; text: string; tokens: Token[]; words: Set<string> };

function readPassage({ language, passage }: { language: string; passage: string }): Passage {
  const text = toKey(passage);

  return {
    names: listMonthNames(language),
    text,
    tokens: toTokens(text),
    words: listDateWords(language),
  };
}

/** Only a date's own words, and its joiners, sit between two of its parts. */
function isJoined({
  from,
  numeric,
  passage,
  to,
}: {
  from: number;
  numeric: boolean;
  passage: Passage;
  to: number;
}): boolean {
  const { text, tokens, words } = passage;
  const between = tokens.slice(from + 1, to);

  const joiner = tokens
    .slice(from, to)
    .map((token, offset) => text.slice(token.end, tokens[from + offset + 1]?.start))
    .join("");

  return (
    between.every((token) => words.has(token.text)) &&
    (numeric && between.length === 0 ? NUMERIC_JOINER : NAMED_JOINER).test(joiner)
  );
}

type DateParts = { day: number; month: number; year: number };
type DateIndexes = { day: number; month: number; year: number };

/**
 * A month named in words reads in any order. In numbers, "05/10/2025" is May or October depending
 * on the page's country, so only a year-first date or a day above 12 says which number is the day.
 */
function isReadable({
  date,
  indexes,
  numeric,
}: {
  date: DateParts;
  indexes: DateIndexes;
  numeric: boolean;
}): boolean {
  const { day, month, year } = indexes;

  return !numeric || (year < month && month < day) || date.day > MONTHS || date.day === date.month;
}

function listIndexes(passage: Passage, isPart: (token: string) => boolean): number[] {
  return passage.tokens.flatMap((token, index) => (isPart(token.text) ? [index] : []));
}

/** The date's year, month and day form one expression: next to each other, in a form dates take. */
function hasDateExpression({ date, passage }: { date: DateParts; passage: Passage }): boolean {
  const { names, tokens } = passage;

  const isNamed = (index: number) =>
    isMonthName({ month: date.month, names, token: tokens[index]?.text ?? "" });

  const years = listIndexes(passage, (token) => token === String(date.year));
  const days = listIndexes(passage, (token) => isShortNumber({ token, value: date.day }));

  const months = listIndexes(
    passage,
    (token) =>
      isMonthName({ month: date.month, names, token }) ||
      isShortNumber({ token, value: date.month }),
  );

  return years.some((year) =>
    months.some((month) =>
      days.some((day) => {
        const indexes = { day, month, year };
        const sorted = [day, month, year].toSorted((first, second) => first - second);
        const numeric = !isNamed(month);

        return (
          new Set(sorted).size === sorted.length &&
          sorted
            .slice(1)
            .every((to, position) =>
              isJoined({ from: sorted[position] ?? -1, numeric, passage, to }),
            ) &&
          isReadable({ date, indexes, numeric })
        );
      }),
    ),
  );
}

/**
 * The passage states the date's day, month and year as one date, the month as a number or a name
 * in `language`, so a passage stating another day or month never confirms it, and a release number
 * beside a month and year ("Orbit Notes 4 shipped in May 2024") is no day.
 */
export function isDateStated({
  date,
  language,
  passage,
}: {
  date: Date;
  language: string;
  passage: string;
}): boolean {
  return hasDateExpression({
    date: { day: date.getUTCDate(), month: date.getUTCMonth() + 1, year: date.getUTCFullYear() },
    passage: readPassage({ language, passage }),
  });
}

/** The version on its own ("v1.37", "1.37"), not inside "1.370" or "21.37". */
function toVersionPattern({ flags, version }: { flags: string; version: string }): RegExp {
  const escaped = version.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(`(?<![\\p{L}\\p{N}.])v?${escaped}(?![\\p{L}\\p{N}]|\\.\\p{N})`, flags);
}

export function hasVersionToken({ text, version }: { text: string; version: string }): boolean {
  return toVersionPattern({ flags: "iu", version }).test(text);
}

/** `text` ends (or, with `atStart`, starts) with `name` as whole words. */
function hasNameAtEdge({
  atStart = false,
  name,
  text,
}: {
  atStart?: boolean;
  name: string;
  text: string;
}): boolean {
  const [key, nameKey] = [toKey(text), toKey(name)];
  const isEdge = atStart ? key.startsWith(nameKey) : key.endsWith(nameKey);
  const next = atStart ? key.at(nameKey.length) : key.at(-nameKey.length - 1);

  return nameKey !== "" && isEdge && !LETTER_OR_NUMBER.test(next ?? "");
}

/**
 * The version opens its line (`LINE_OPENING`), or the product's own name sits right before it or
 * follows it after a space. A version beside any other name ("Comet Phone 1.37") is another
 * product's.
 */
function isVersionOfLine({
  passage,
  productNames,
  version,
}: {
  passage: string;
  productNames: readonly string[];
  version: string;
}): boolean {
  return [...passage.matchAll(toVersionPattern({ flags: "giu", version }))].some((match) => {
    const lineEnd = passage.indexOf("\n", match.index);

    const opening = passage.slice(passage.lastIndexOf("\n", match.index) + 1, match.index);

    const before = opening
      .replace(TRAILING_MARKS, "")
      .replace(RELEASE_WORD, "")
      .replace(TRAILING_MARKS, "");

    const after = passage
      .slice(match.index + match[0].length, lineEnd === -1 ? undefined : lineEnd)
      .replace(LEADING_SPACE, "");

    return (
      LINE_OPENING.test(opening) ||
      productNames.some(
        (name) =>
          hasNameAtEdge({ name, text: before }) ||
          hasNameAtEdge({ atStart: true, name, text: after }),
      )
    );
  });
}

/**
 * A releases table or changelog often lists a version without the product's name ("1.37 |
 * 2026-09-15"). A version with a separator is specific enough to stand for its release there; a bare
 * "5" isn't.
 */
export function isVersionStated({
  name,
  passage,
  productNames,
  version,
}: {
  name: string;
  passage: string;
  productNames: readonly string[];
  version: string | null;
}): boolean {
  return (
    version !== null &&
    VERSION_SEPARATOR.test(version) &&
    hasVersionToken({ text: name, version }) &&
    isVersionOfLine({ passage, productNames, version })
  );
}
