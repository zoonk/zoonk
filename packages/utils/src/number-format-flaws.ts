import { isJsonObject } from "./json";
import { getFormattingLocale } from "./locale";
import { splitLinesAndCells } from "./markdown-table";
import { splitAtMath } from "./math-spans";

/**
 * Five or more ungrouped digits outside a decimal, code, date or word. A leading 0 is a postal code
 * or an ID, and shorter numbers stay ungrouped in every language, so a year reads 2026.
 */
const LONG_NUMBER = /(?<![\d.,\p{L}/-])[1-9]\d{4,}(?![\d\p{L}/-]|[.,]\d)/gu;

const CODE = /```[\s\S]*?```|`[^`\n]+`/gu;

/** A comma between digits, which KaTeX sets as a list ("0, 5") unless it's braced ("0{,}5"). */
const BARE_COMMA = /\d,\d/u;

const NUMBER_LIST = /[([]\s*-?\d+(?:\s*,\s*-?\d+)+\s*[)\]]/gu;

const GROUPING_SPACE = /[\u00A0\u202F ]/gu;

/**
 * A number whose thousands are split by a space ("50 000"), in prose or in LaTeX (a thin space
 * `\,`), read where the language groups another way: the same number then shows two ways on one
 * screen. Its sign and decimals are part of it. Digits a space only sits beside, like a phone
 * number's, aren't one number.
 */
function spaceGroupedNumber(space: string): { number: RegExp; space: RegExp } {
  return {
    number: new RegExp(
      String.raw`(?<![\d.,\p{L}/+-]|\d${space})[-−]?[1-9]\d{0,2}(?:${space}\d{3})+(?:[.,]\d+)?(?!${space}?\d|[\p{L}/-])`,
      "gu",
    ),
    space: new RegExp(space, "gu"),
  };
}

const SPACE_GROUPED = {
  latex: spaceGroupedNumber(String.raw`(?:\\[,;]|[\u00A0\u202F ])`),
  prose: spaceGroupedNumber(String.raw`[\u00A0\u202F ]`),
};

const GROUPED_SAMPLE = 10_000;

const DECIMAL_SAMPLE = 1.5;

const NOT_TEXT_FIELDS = new Set([
  "acceptedAnswers",
  "code",
  "content",
  "expression",
  "formula",
  "prompt",
  "solution",
]);

const LATEX_FIELD = "math";

type TextParts = { math: string[]; prose: string };

function splitText({ latex, text }: { latex: boolean; text: string }): TextParts {
  const written = text.replaceAll(CODE, " ");

  if (latex) {
    return { math: [written], prose: "" };
  }

  const segments = splitLinesAndCells(written)
    .flat()
    .flatMap((cell) => splitAtMath(cell));

  return {
    math: segments.flatMap((segment) => (segment.kind === "text" ? [] : [segment.text])),
    prose: segments.flatMap((segment) => (segment.kind === "text" ? [segment.text] : [])).join(" "),
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
  const parts = new Intl.NumberFormat(getFormattingLocale(language)).formatToParts(DECIMAL_SAMPLE);
  return parts.some((part) => part.type === "decimal" && part.value === ",");
}

function groupSeparator(number: Intl.NumberFormat): string {
  return number.formatToParts(GROUPED_SAMPLE).find((part) => part.type === "group")?.value ?? "";
}

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

function findSpaceGrouping({
  latex,
  number,
  text,
}: {
  latex: boolean;
  number: Intl.NumberFormat;
  text: string;
}): string[] {
  const separator = groupSeparator(number);

  if (separator.trim() === "") {
    return [];
  }

  const grouped = latex ? SPACE_GROUPED.latex : SPACE_GROUPED.prose;

  return [...text.matchAll(grouped.number)].map(([written]) => {
    const rewritten = written.replaceAll(grouped.space, separator);
    return `Groups ${written} with a space; write ${latex ? toLatexNumber(rewritten) : rewritten}.`;
  });
}

function findBareCommas(math: string): string[] {
  return BARE_COMMA.test(math.replaceAll(NUMBER_LIST, " "))
    ? [
        `Writes a decimal comma in LaTeX math as a bare comma, which shows as a list: "${math.trim()}". Brace it, as in 0{,}5.`,
      ]
    : [];
}

export function findNumberFormatFlaws({
  language,
  value,
}: {
  language: string;
  value: unknown;
}): string[] {
  const number = new Intl.NumberFormat(getFormattingLocale(language));
  const decimalComma = usesDecimalComma(language);

  return collectTexts(value).flatMap(({ math, prose }) => [
    ...findLongNumbers({ latex: false, number, text: prose }),
    ...findSpaceGrouping({ latex: false, number, text: prose }),
    ...math.flatMap((formula) => [
      ...findLongNumbers({ latex: true, number, text: formula }),
      ...findSpaceGrouping({ latex: true, number, text: formula }),
      ...(decimalComma ? findBareCommas(formula) : []),
    ]),
  ]);
}
