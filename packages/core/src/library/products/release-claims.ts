/** "October 21st, 2025" and "21 de outubro de 2025" fit; dates further apart are two facts. */
const DATE_SPAN = 6;
const MIN_MONTH_PREFIX = 3;
const MONTHS = 12;
/** Any year: only the month names are read. */
const NAMING_YEAR = 2000;
const TOKEN = /\p{L}+|\p{N}+/gu;
const SHORT_NUMBER = /^\d{1,2}$/u;
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

function toTokens(text: string): string[] {
  return text.normalize("NFKC").toLowerCase().match(TOKEN) ?? [];
}

function listMonthNames(language: string): string[] {
  const format = new Intl.DateTimeFormat(language, { month: "long", timeZone: "UTC" });

  return Array.from({ length: MONTHS }, (_, index) =>
    format
      .format(new Date(Date.UTC(NAMING_YEAR, index, 1)))
      .normalize("NFKC")
      .toLowerCase(),
  );
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

type DateRole = { day: boolean; monthName: boolean; monthNumber: boolean; year: boolean };

type DateParts = { day: number; month: number };

/**
 * A month named in words reads in any order. In numbers, "05/10/2025" is May or October depending
 * on the page's country, so only a year-first date or a day above 12 says which number is the day.
 */
function isReadable({
  date,
  indexes,
  roles,
}: {
  date: DateParts;
  indexes: { day: number; month: number; year: number };
  roles: DateRole[];
}): boolean {
  const { day, month, year } = indexes;

  return (
    roles[month]?.monthName === true ||
    (year < month && month < day) ||
    date.day > MONTHS ||
    date.day === date.month
  );
}

function hasWholeDate({ date, roles }: { date: DateParts; roles: DateRole[] }): boolean {
  const indexes = roles.map((_, index) => index);

  return indexes.some(
    (year) =>
      roles[year]?.year &&
      indexes.some(
        (month) =>
          month !== year &&
          (roles[month]?.monthName || roles[month]?.monthNumber) &&
          indexes.some(
            (day) =>
              day !== year &&
              day !== month &&
              roles[day]?.day &&
              isReadable({ date, indexes: { day, month, year }, roles }),
          ),
      ),
  );
}

/**
 * The passage states the date's year, month and day close together, the month as a number or a
 * name in `language`, so a passage stating another day or month never confirms it.
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
  const year = String(date.getUTCFullYear());
  const parts = { day: date.getUTCDate(), month: date.getUTCMonth() + 1 };
  const names = listMonthNames(language);

  const roles = toTokens(passage).map((token) => ({
    day: isShortNumber({ token, value: parts.day }),
    monthName: isMonthName({ month: parts.month, names, token }),
    monthNumber: isShortNumber({ token, value: parts.month }),
    year: token === year,
  }));

  return roles.some((_, start) =>
    hasWholeDate({ date: parts, roles: roles.slice(start, start + DATE_SPAN) }),
  );
}

/** The version on its own ("v1.37", "1.37"), not inside "1.370" or "21.37". */
function toVersionPattern({ flags, version }: { flags: string; version: string }): RegExp {
  const escaped = version.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(`(?<![\\p{L}\\p{N}.])v?${escaped}(?![\\p{L}\\p{N}]|\\.\\p{N})`, flags);
}

export function hasVersionToken({ text, version }: { text: string; version: string }): boolean {
  return toVersionPattern({ flags: "iu", version }).test(text);
}

function toKey(text: string): string {
  return text.normalize("NFKC").toLowerCase();
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
