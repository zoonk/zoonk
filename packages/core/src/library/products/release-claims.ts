const MIN_MONTH_PREFIX = 3;
const MONTHS = 12;
/** Any year: only the month names and a date's words are read. */
const NAMING_YEAR = 2000;
const TOKEN = /\p{L}+|\p{N}+/gu;
const SHORT_NUMBER = /^\d{1,2}$/u;
const NUMBER = /^\p{N}+$/u;
const LETTER = /\p{L}/u;
/** Ordinals and the words pages write inside a date beyond `Intl`'s formats ("the 4th of May", "1er mai"). */
const DATE_WORDS = ["er", "nd", "of", "rd", "st", "th"];
/** A space, a comma or a period between a named month's date parts, or a slash or hyphen alone. */
const NAMED_JOINER = /^(?:[.,]?[ \t\u00A0\u202F]*|[/-])$/u;
/** "2025-10-21", "21/10/2025" and "21.10.2025"; a space alone joins no numeric date. */
const NUMERIC_JOINER = /^[./-]$/u;
/** "2024-10" and "10/2024", never "2024.10", which is how versions are written. */
const NUMERIC_MONTH_JOINER = /^[/-]$/u;
const VERSION_SEPARATOR = /[\p{L}\p{N}][._-][\p{L}\p{N}]/u;
const NUMBERED_VERSION = /\p{N}+(?:[._-]\p{N}+)+/gu;
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

/** Each month's name alone and as the language writes it inside a date ("maj" and "maja"). */
function listMonthNames(language: string): string[][] {
  const alone = new Intl.DateTimeFormat(language, { month: "long", timeZone: "UTC" });

  const inDates = (["long", "short"] as const).map(
    (month) =>
      new Intl.DateTimeFormat(language, {
        day: "numeric",
        month,
        timeZone: "UTC",
        year: "numeric",
      }),
  );

  return Array.from({ length: MONTHS }, (_, index) => {
    const date = new Date(Date.UTC(NAMING_YEAR, index, 1));

    const forms = inDates.flatMap((format) =>
      format.formatToParts(date).filter((part) => part.type === "month" && LETTER.test(part.value)),
    );

    return [
      ...new Set(
        [alone.format(date), ...forms.map((part) => part.value)].map((name) => toKey(name)),
      ),
    ];
  });
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

/** A month's name, or an abbreviation no other month's names start with ("oct", "sept"). */
function isMonthName({ month, names, token }: { month: number; names: string[][]; token: string }) {
  if (token.length < MIN_MONTH_PREFIX) {
    return false;
  }

  const matches = names.flatMap((forms, index) =>
    forms.some((name) => name.startsWith(token)) ? [index + 1] : [],
  );

  return matches.length === 1 && matches[0] === month;
}

function isShortNumber({ token, value }: { token: string; value: number }): boolean {
  return SHORT_NUMBER.test(token) && Number(token) === value;
}

type Passage = { names: string[][]; text: string; tokens: Token[]; words: Set<string> };

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
  numericJoiner,
  passage,
  to,
}: {
  from: number;
  /** For a month written as a number; null for a named month. */
  numericJoiner: RegExp | null;
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
    (numericJoiner && between.length === 0 ? numericJoiner : NAMED_JOINER).test(joiner)
  );
}

type DateParts = { day: number | null; month: number; year: number };
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
  date: { day: number; month: number };
  indexes: DateIndexes;
  numeric: boolean;
}): boolean {
  const { day, month, year } = indexes;

  return !numeric || (year < month && month < day) || date.day > MONTHS || date.day === date.month;
}

function isNumberJoined({ gap, token }: { gap: string; token: Token | undefined }): boolean {
  return token !== undefined && NUMBER.test(token.text) && NUMERIC_JOINER.test(gap);
}

/** A numeric month and year that don't continue a longer numeric date ("05/10/2024"). */
function standsAlone({ from, passage, to }: { from: number; passage: Passage; to: number }) {
  const { text, tokens } = passage;
  const [before, first, last, after] = [tokens[from - 1], tokens[from], tokens[to], tokens[to + 1]];

  return (
    !isNumberJoined({ gap: text.slice(before?.end, first?.start), token: before }) &&
    !isNumberJoined({ gap: text.slice(last?.end, after?.start), token: after })
  );
}

function listIndexes(passage: Passage, isPart: (token: string) => boolean): number[] {
  return passage.tokens.flatMap((token, index) => (isPart(token.text) ? [index] : []));
}

/**
 * The date's year, month and day (when it has one) form one expression: next to each other, in a
 * form dates take.
 */
function hasDateExpression({ date, passage }: { date: DateParts; passage: Passage }): boolean {
  const { names, tokens } = passage;

  const isNamed = (index: number) =>
    isMonthName({ month: date.month, names, token: tokens[index]?.text ?? "" });

  const years = listIndexes(passage, (token) => token === String(date.year));

  const months = listIndexes(
    passage,
    (token) =>
      isMonthName({ month: date.month, names, token }) ||
      isShortNumber({ token, value: date.month }),
  );

  const { day } = date;

  const days =
    day === null ? [null] : listIndexes(passage, (token) => isShortNumber({ token, value: day }));

  return years.some((year) =>
    months.some((month) =>
      days.some((dayIndex) => {
        const numeric = !isNamed(month);
        const numericJoiner = numeric && dayIndex === null ? NUMERIC_MONTH_JOINER : NUMERIC_JOINER;

        const parts = (dayIndex === null ? [month, year] : [dayIndex, month, year]).toSorted(
          (first, second) => first - second,
        );

        return (
          new Set(parts).size === parts.length &&
          parts
            .slice(1)
            .every((to, position) =>
              isJoined({
                from: parts[position] ?? -1,
                numericJoiner: numeric ? numericJoiner : null,
                passage,
                to,
              }),
            ) &&
          (!numeric ||
            dayIndex !== null ||
            standsAlone({ from: parts[0] ?? -1, passage, to: parts.at(-1) ?? -1 })) &&
          (day === null ||
            dayIndex === null ||
            isReadable({
              date: { day, month: date.month },
              indexes: { day: dayIndex, month, year },
              numeric,
            }))
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

/**
 * The passage states the date's month and year together ("Outubro/2024", "October 2024",
 * "2024-10"): never a year alone, nor a version written like a date ("2024.10").
 */
export function isMonthStated({
  date,
  language,
  passage,
}: {
  date: Date;
  language: string;
  passage: string;
}): boolean {
  return hasDateExpression({
    date: { day: null, month: date.getUTCMonth() + 1, year: date.getUTCFullYear() },
    passage: readPassage({ language, passage }),
  });
}

/** The version, or a name ending in one, on its own ("v1.37", "1.37"), not inside "1.370" or "21.37". */
function toVersionPattern({ flags, version }: { flags: string; version: string }): RegExp {
  const escaped = version
    .trim()
    .split(/\s+/u)
    .map((word) => word.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`))
    .join(String.raw`\s+`);

  return new RegExp(`(?<![\\p{L}\\p{N}.])v?${escaped}(?![\\p{L}\\p{N}]|\\.\\p{N})`, flags);
}

export function hasVersionToken({ text, version }: { text: string; version: string }): boolean {
  return toVersionPattern({ flags: "iu", version }).test(text);
}

/**
 * The passage without the release's own name and numbered versions, the claimed one and any in its
 * name: neither a version written like a date ("Orbit Notes 2024.05.04") nor the name's number
 * beside a month ("Orbit Notes 4 November 2026") states the release's date. A bare number elsewhere
 * stays, since it may be the date's day ("Next.js 5" shipped on "5 Feb 2018").
 */
export function withoutReleaseName({
  name,
  passage,
  version,
}: {
  name: string;
  passage: string;
  version: string | null;
}): string {
  const versions = [version ?? "", name].flatMap((text) => text.match(NUMBERED_VERSION) ?? []);

  return [name, ...versions].reduce(
    (text, item) => text.replaceAll(toVersionPattern({ flags: "giu", version: item }), " "),
    passage,
  );
}

/**
 * A releases table or changelog often lists a version without the product's name ("1.37 |
 * 2026-09-15"). A version with a separator is specific enough to stand for its release there; a bare
 * "5" isn't. Where such a row may count is the reading's rule (`checkProductReading`).
 */
export function isVersionStated({
  name,
  passage,
  version,
}: {
  name: string;
  passage: string;
  version: string | null;
}): boolean {
  return (
    version !== null &&
    VERSION_SEPARATOR.test(version) &&
    hasVersionToken({ text: name, version }) &&
    hasVersionToken({ text: passage, version })
  );
}
