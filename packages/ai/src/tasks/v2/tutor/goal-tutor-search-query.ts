import { type PlanScopeContext } from "../../lessons/lesson-question-context";
import { collectPublicText } from "./goal-tutor-search-public-text";
import {
  SEARCH_LAW_WORDS,
  SEARCH_REFERENCE_WORDS,
  SEARCH_TERMS,
  normalizeSearchWord,
} from "./goal-tutor-search-terms";

/** Besides the code's own vocabulary (`SEARCH_TERMS`). */
export type GoalTutorSearchSources = {
  contextSnapshot: PlanScopeContext;
  /** Facts the learner shared before: never searched, and their words never go out. */
  learnerMemory?: readonly string[];
  /** The names the learner goes by (account, username, email, buddy): never go out either. */
  learnerNames?: readonly string[];
};

const MAX_QUERIES = 3;

/** Parallel's limit for one query. */
const MAX_QUERY_LENGTH = 200;

/** Seven digits or more is a phone, an ID, an account or a postal code, not a law or a year. */
const LONG_NUMBER_DIGITS = 7;

/** A reference's own number: an article, a ruling, a súmula ("art. 21", "ADI 1194"). */
const MAX_REFERENCE_DIGITS = 4;

/** A law's own number ("Lei 14133"). */
const MAX_LAW_DIGITS = 5;

/**
 * Where a word shaped like personal data was taken out: a word of its own, which nothing keeps, so
 * the reference before it can't reach the number after it ("art. user@example.com 1234").
 */
const BOUNDARY = "\u0001";

const RUN = /[\p{L}\p{N}]+/gu;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const NOT_DIGIT = /\D/gu;
const WHITESPACE = /\s+/u;
const SPACED = /(?<space>\s+)/u;
const PLAIN_NUMBER = /^\d+$/u;

/** Invisible characters (zero-width spaces, joiners, direction marks) that would hide a word. */
const FORMAT_CHARACTERS = /\p{Cf}/gu;

/** A number written with thousands dots ("8.666", "14.133"). */
const THOUSANDS = /\b\d{1,3}(?:\.\d{3})+\b/gu;

/** A number however it's written: with dots, dashes, slashes, brackets or spaces between digits. */
const NUMBER_SPAN = /\+?\(?\d[\d\s()./-]*\d/gu;

/** A number in the learner's own words, with commas between its digits too ("1,234"). */
const WRITTEN_NUMBER = /\d[\d\s(),./-]*\d/gu;

/**
 * A law's number, with its year or not ("8.906/1994", "14.133/2021", "9099/95", "8.666"): never
 * part of a phone or an ID written next to it ("Lei 8.666 14.133"). Its year is a year (19xx, 20xx
 * or two digits), so a phone written the same way ("98765/4321") isn't one.
 */
const LAW_NUMBER = /^(?:(?:\d{1,2}\.\d{3}|\d{1,5})\/(?:\d{2}|(?:19|20)\d{2})|\d{1,2}\.\d{3})$/u;

/** A section sign written against its number ("§2"), read as the sign and the number. */
const ATTACHED_SECTION = /§(?=\d)/gu;

/** What a query's word keeps: letters, digits and the marks legal references are written with. */
const DROPPED_CHARACTERS = /[^\p{L}\p{N}.,/§()"'ºª-]/gu;
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}§]+|[^\p{L}\p{N}§]+$/gu;
const ORDINAL_MARKS = /[ºª]/gu;

const DOMAIN = /^[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*\.\p{L}{2,}$/u;
const DAY_MONTH = /^(?<first>\d{1,2})[/-](?<second>\d{1,2})$/u;

const FULL_DATE =
  /^(?<first>\d{1,2})(?<separator>[./-])(?<second>\d{1,2})\k<separator>(?:\d{2}|\d{4})$/u;

const ISO_DATE = /^\d{4}(?<separator>[./-])(?<month>\d{1,2})(?:\k<separator>\d{1,2})?$/u;
const MONTH_YEAR = /^(?<month>\d{1,2})[/-]\d{4}$/u;
const TIME = /^\d{1,2}(?::\d{2}){1,2}$|^\d{1,2}h(?:\d{2})?(?:min)?$/iu;

const MAX_DAY = 31;
const MAX_MONTH = 12;

/**
 * One text as the search reads it, with nothing hidden in it. Compatible forms stay as written
 * ("２１", "ＳＴＦ"): no vocabulary has them, so they never go out.
 */
function toPlainText(text: string): string {
  return text.replaceAll(FORMAT_CHARACTERS, "");
}

/** Thousands dots don't make another number: "8.666" is "8666". */
function withoutThousandsDots(text: string): string {
  return text.replaceAll(THOUSANDS, (number) => number.replaceAll(".", ""));
}

function toRuns(text: string): string[] {
  return (withoutThousandsDots(toPlainText(text)).match(RUN) ?? []).map((run) =>
    normalizeSearchWord(run),
  );
}

function isDayAndMonth(first: string | undefined, second: string | undefined): boolean {
  const numbers = [Number(first), Number(second)];

  return numbers.every((part) => part >= 1 && part <= MAX_DAY) && Math.min(...numbers) <= MAX_MONTH;
}

function isMonth(value: string | undefined): boolean {
  const month = Number(value);
  return month >= 1 && month <= MAX_MONTH;
}

/** "14/10", "14.10.2026", "2026-10-14", "10/2026": a day of someone's life, never a law's. */
function isDate(word: string): boolean {
  const dayMonth = FULL_DATE.exec(word)?.groups ?? DAY_MONTH.exec(word)?.groups;

  if (dayMonth) {
    return isDayAndMonth(dayMonth.first, dayMonth.second);
  }

  return (
    isMonth(ISO_DATE.exec(word)?.groups?.month) || isMonth(MONTH_YEAR.exec(word)?.groups?.month)
  );
}

/** A contact, a web address, a date or a time: what a learner's own words carry, never a search. */
function isPersonalWord(word: string): boolean {
  const core = word.replaceAll(EDGE_PUNCTUATION, "");

  return (
    word.includes("@") ||
    word.includes("://") ||
    DOMAIN.test(core) ||
    isDate(core) ||
    TIME.test(core)
  );
}

function countDigits(text: string): number {
  return text.replaceAll(NOT_DIGIT, "").length;
}

/**
 * A number of seven digits or more, spaced or not ("(11) 98765-4321", "123.456.789-09"), comes
 * out; a law's number inside it stays ("Lei 8.906/1994").
 */
function blankLongNumber(span: string): string {
  const pieces = span.split(SPACED);
  const digits = countDigits(pieces.filter((piece) => !LAW_NUMBER.test(piece)).join(""));

  if (digits < LONG_NUMBER_DIGITS) {
    return span;
  }

  return pieces
    .map((piece) => (LAW_NUMBER.test(piece) || WHITESPACE.test(piece) ? piece : BOUNDARY))
    .join("");
}

/** A query's words, without the ones shaped like personal data. */
function toPublicShapedWords(text: string): string[] {
  return toPlainText(text)
    .replaceAll(ATTACHED_SECTION, "§ ")
    .replaceAll(NUMBER_SPAN, (span) => blankLongNumber(span))
    .split(WHITESPACE)
    .filter(Boolean)
    .map((word) => (isPersonalWord(word) ? BOUNDARY : word));
}

/** A text's numbers as digits alone, however they're written: "14-133" is "14133", "1,234" "1234". */
function toDigitSpans(text: string): string[] {
  return (toPlainText(text).match(WRITTEN_NUMBER) ?? []).map((span) =>
    span.replaceAll(NOT_DIGIT, ""),
  );
}

type Allowed = { personal: ReadonlySet<string>; public: ReadonlySet<string>; year: string };

function collectAllowed({
  contextSnapshot,
  learnerMemory = [],
  learnerNames = [],
}: GoalTutorSearchSources): Allowed {
  const publicRuns = new Set(collectPublicText(contextSnapshot).flatMap((text) => toRuns(text)));
  const { cutoff, target, title } = contextSnapshot.goal;
  const own = [...learnerNames, ...learnerMemory, title, target ?? "", cutoff?.target ?? ""];

  const ownRuns = own.flatMap((text) => [...toRuns(text), ...toDigitSpans(text)]);

  return {
    // A word or number of their memory or goal stays theirs, unless the public text has it too.
    personal: new Set(ownRuns.filter((run) => !publicRuns.has(run))),
    public: publicRuns,
    year: String(new Date().getUTCFullYear()),
  };
}

/**
 * A number goes out as a reference only: right after the word that names it, up to four digits
 * ("art. 21", "ADI 1194", "Súmula 331") or five after a law's ("Lei 14133"), as this year, or as
 * the public text writes it (an exam's year). Anything else (an age, a birth or plan year, a day,
 * a phone in pieces) stays in.
 */
function isAllowedNumber({
  allowed,
  previous,
  run,
}: {
  allowed: Allowed;
  previous: string | null;
  run: string;
}): boolean {
  const reference =
    previous !== null && SEARCH_REFERENCE_WORDS.has(previous) && run.length <= MAX_REFERENCE_DIGITS;

  const law = previous !== null && SEARCH_LAW_WORDS.has(previous) && run.length <= MAX_LAW_DIGITS;

  return allowed.public.has(run) || reference || law || run === allowed.year;
}

function isAllowedRun({
  allowed,
  previous,
  run,
}: {
  allowed: Allowed;
  previous: string | null;
  run: string;
}): boolean {
  if (allowed.personal.has(run)) {
    return false;
  }

  if (PLAIN_NUMBER.test(run)) {
    return isAllowedNumber({ allowed, previous, run });
  }

  return allowed.public.has(run) || SEARCH_TERMS.has(run);
}

/** Whether every run of a word is allowed, each read after the run before it. */
function areAllowedRuns({
  allowed,
  previous,
  runs,
}: {
  allowed: Allowed;
  previous: string | null;
  runs: readonly string[];
}): boolean {
  return runs.every((run, index) =>
    isAllowedRun({ allowed, previous: index === 0 ? previous : (runs[index - 1] ?? null), run }),
  );
}

/**
 * A law's number as it's written, where a law is named: right after the word that names it ("Lei
 * 8.906/1994"), after another law's number ("Lei 8.666 14.133") or as the public text writes it;
 * never when its digits, however they're written, are the learner's own.
 */
function isAllowedLawNumber({
  afterLaw,
  allowed,
  core,
  previous,
  runs,
}: {
  afterLaw: boolean;
  allowed: Allowed;
  core: string;
  previous: string | null;
  runs: readonly string[];
}): boolean {
  if (!LAW_NUMBER.test(core)) {
    return false;
  }

  const digits = [...runs, core.replaceAll(NOT_DIGIT, "")];
  const named = afterLaw || (previous !== null && SEARCH_LAW_WORDS.has(previous));

  return (
    digits.every((run) => !allowed.personal.has(run)) &&
    (named || runs.every((run) => allowed.public.has(run)))
  );
}

/**
 * The query's words that may go out, in order: a law's number as it's written, the section sign,
 * or a word every run of which is allowed (`isAllowedRun`), read right after the word before it. A
 * word that stays in breaks the reference, so a number after it can't lean on a word before it.
 */
function keepWords({ allowed, words }: { allowed: Allowed; words: readonly string[] }): string[] {
  const kept: string[] = [];
  let previous: string | null = null;
  let afterLaw = false;

  for (const word of words) {
    const cleaned = word.replaceAll(DROPPED_CHARACTERS, "");
    const core = cleaned.replaceAll(EDGE_PUNCTUATION, "");
    const runs = toRuns(core.replaceAll(ORDINAL_MARKS, ""));
    const section = core === "§";
    const lawNumber = isAllowedLawNumber({ afterLaw, allowed, core, previous, runs });

    const keep: boolean =
      core !== "" &&
      !isPersonalWord(cleaned) &&
      (section || lawNumber || (runs.length > 0 && areAllowedRuns({ allowed, previous, runs })));

    if (keep) {
      kept.push(cleaned);
    }

    const last = section ? "§" : (runs.at(-1) ?? null);
    previous = keep ? last : null;
    afterLaw = keep && lawNumber;
  }

  return kept;
}

/** At most Parallel's length, cut after a whole word. */
function cutAtWord(query: string): string {
  if (query.length <= MAX_QUERY_LENGTH) {
    return query;
  }

  const cut = query.slice(0, MAX_QUERY_LENGTH + 1);
  const end = cut.lastIndexOf(" ");

  return end === -1 ? "" : cut.slice(0, end);
}

function dedupe(queries: readonly string[]): string[] {
  const keys = queries.map((query) => normalizeSearchWord(query));
  return queries.filter((_, index) => keys.indexOf(keys[index] ?? "") === index);
}

/**
 * Built in code from the model's queries, so none of the learner's data reaches the search
 * provider: words go out only from vocabularies the same for every learner (the public text asked
 * about, `SEARCH_TERMS`, and numbers as references). Shapes of personal data come out first and
 * break the reference before them.
 *
 * Accepted residual (14 Oct 2026): a name made only of vocabulary words, or an ID shaped like a
 * law's number after a law's name, can go out when the model copies it. The request carries no
 * learner identity, so neither can be tied to a person.
 */
export function buildSearchQueries({
  queries,
  ...sources
}: GoalTutorSearchSources & { queries: readonly string[] }): string[] {
  const allowed = collectAllowed(sources);

  const built = queries.map((query) =>
    cutAtWord(keepWords({ allowed, words: toPublicShapedWords(query) }).join(" ")),
  );

  return dedupe(built.filter((query) => LETTER_OR_DIGIT.test(query))).slice(0, MAX_QUERIES);
}
