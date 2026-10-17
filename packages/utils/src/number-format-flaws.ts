import { isJsonObject } from "./json";

/**
 * A whole number of five digits or more written without grouping ("40000000"), not part of a
 * decimal, a code, a date or a word, and not starting with 0 (a postal code or an ID). Shorter
 * numbers stay ungrouped in every language, so a year reads 2026.
 */
const LONG_NUMBER = /(?<![\d.,\p{L}/-])[1-9]\d{4,}(?![\d\p{L}/-]|[.,]\d)/gu;

/** Inline code and fenced code, whose numbers are code. */
const CODE = /```[\s\S]*?```|`[^`\n]+`/gu;

/**
 * `$$display$$` and `$inline$` math by Pandoc's rule, as the player reads it: an opening `$` has
 * text right after it and no letter before it ("R$ 80" is money), and a closing `$` has text right
 * before it and no digit after it, so "$5 and $10" stay text.
 */
const MATH = /\$\$(?<display>[^$]+)\$\$|(?<![\p{L}\\$])\$(?=\S)(?<inline>[^$\n]*?\S)\$(?!\d)/gu;

/** A comma between digits, which KaTeX sets as a list ("0, 5") unless it's braced ("0{,}5"). */
const BARE_COMMA = /\d,\d/u;

/** A pair or list of whole numbers, such as a point (3,4) or an interval [0,1], whose commas separate. */
const NUMBER_LIST = /[([]\s*-?\d+(?:\s*,\s*-?\d+)+\s*[)\]]/gu;

/** The spaces some languages group digits with ("40 000 000" in French), a thin space in LaTeX. */
const GROUPING_SPACE = /[   ]/gu;

/** Any number with a fraction, formatted to find the language's decimal separator. */
const DECIMAL_SAMPLE = 1.5;

/** Fields that hold data, code, answers to match or a picture's request, never words to read. */
const NOT_TEXT_FIELDS = new Set([
  "acceptedAnswers",
  "code",
  "content",
  "expression",
  "formula",
  "prompt",
  "solution",
]);

/** A worked step's `math`: LaTeX without dollar signs. */
const LATEX_FIELD = "math";

/** One text's prose and the LaTeX math in it, with code left out. */
type TextParts = { math: string[]; prose: string };

function splitText({ latex, text }: { latex: boolean; text: string }): TextParts {
  const written = text.replaceAll(CODE, " ");

  if (latex) {
    return { math: [written], prose: "" };
  }

  return {
    math: [...written.matchAll(MATH)].map(
      (match) => match.groups?.display ?? match.groups?.inline ?? "",
    ),
    prose: written.replaceAll(MATH, " "),
  };
}

function collectTexts(value: unknown, latex = false): TextParts[] {
  if (typeof value === "string") {
    return [splitText({ latex, text: value })];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectTexts(entry, latex));
  }

  if (!isJsonObject(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, entry]) =>
    NOT_TEXT_FIELDS.has(key) ? [] : collectTexts(entry, key === LATEX_FIELD),
  );
}

function usesDecimalComma(language: string): boolean {
  const parts = new Intl.NumberFormat(language).formatToParts(DECIMAL_SAMPLE);
  return parts.some((part) => part.type === "decimal" && part.value === ",");
}

/** How LaTeX writes a grouped number: a braced comma ("40{,}000") and a thin space ("40\,000"). */
function toLatexNumber(grouped: string): string {
  return grouped.replaceAll(",", "{,}").replaceAll(GROUPING_SPACE, String.raw`\,`);
}

function findLongNumbers({
  latex,
  number,
  text,
}: {
  latex: boolean;
  number: Intl.NumberFormat;
  text: string;
}): string[] {
  return [...text.matchAll(LONG_NUMBER)].map(([digits]) => {
    const grouped = number.format(Number(digits));
    return `Writes ${digits} without grouping its digits; write ${latex ? toLatexNumber(grouped) : grouped}.`;
  });
}

function findBareCommas(math: string): string[] {
  return BARE_COMMA.test(math.replaceAll(NUMBER_LIST, " "))
    ? [
        `Writes a decimal comma in LaTeX math as a bare comma, which shows as a list: "${math.trim()}". Brace it, as in 0{,}5.`,
      ]
    : [];
}

/**
 * Numbers a learner would read wrong in written text: a long number without its digits grouped
 * the way `language` groups them ("40000000" for 40.000.000 in Portuguese), and, where the
 * language writes a decimal comma, a bare comma in LaTeX math, which shows as a list ("0, 5")
 * instead of a number ("0{,}5"). Code, data fields, answers to match and picture requests are
 * left out. Returns one problem per flaw, or none.
 */
export function findNumberFormatFlaws({
  language,
  value,
}: {
  language: string;
  value: unknown;
}): string[] {
  const number = new Intl.NumberFormat(language);
  const decimalComma = usesDecimalComma(language);

  return collectTexts(value).flatMap(({ math, prose }) => [
    ...findLongNumbers({ latex: false, number, text: prose }),
    ...math.flatMap((formula) => [
      ...findLongNumbers({ latex: true, number, text: formula }),
      ...(decimalComma ? findBareCommas(formula) : []),
    ]),
  ]);
}
