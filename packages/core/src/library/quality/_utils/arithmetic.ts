import { getBaseLanguage } from "@zoonk/utils/languages";
import { evaluateFormula } from "../../activities/expression/evaluate-expression";

const DECIMAL_COMMA_LANGUAGES: ReadonlySet<string> = new Set(["de", "es", "fr", "it", "pt"]);

const THOUSANDS_GROUP_DIGITS = 3;
const ROUNDING_SLACK = 0.5;
const APPROXIMATE_RELATIVE_SLACK = 0.01;
const FLOAT_SLACK = 1e-9;

const EQUALS = /(?<sign>=|≈)/u;
const TRAILING_ARITHMETIC = /[\d\s.,+\-*/^()]+$/u;
const LEADING_PUNCTUATION = /^[\s.,]*/u;
const LEADING_NUMBER = /^\s*(?<number>-?\d[\d.,]*\d|-?\d)(?<after>.?)/u;
const NUMBER_TOKEN = /\d[\d.,]*\d|\d/gu;
const BINARY_OPERATION = /[\d)]\s*[+\-*/^]\s*[\d(-]/u;
const ATTACHED_BEFORE = /[\p{L}^_\\]/u;
const ATTACHED_AFTER = /[\p{L}\d%^*/]/u;

type ParsedNumber = { decimals: number; value: number };

function normalizeMath(text: string): string {
  return text
    .replaceAll(/\\left|\\right/gu, "")
    .replaceAll(/\\(?:times|cdot)|[×·⋅]/gu, "*")
    .replaceAll(/\\div|÷/gu, "/")
    .replaceAll("−", "-")
    .replaceAll(/\\d?frac\{(?<top>[^{}]+)\}\{(?<bottom>[^{}]+)\}/gu, "(($<top>)/($<bottom>))")
    .replaceAll("{,}", ",")
    .replaceAll(/\\[ ,;:!]/gu, " ")
    .replaceAll(String.raw`\approx`, "≈")
    .replaceAll("{", "(")
    .replaceAll("}", ")")
    .replaceAll("$", " ");
}

function isDecimalComma(language: string): boolean {
  return DECIMAL_COMMA_LANGUAGES.has(getBaseLanguage(language));
}

function parseNumber(token: string, language: string): ParsedNumber | null {
  const thousands = isDecimalComma(language) ? "." : ",";
  const separators = [...token.matchAll(/[.,]/gu)].map((match) => match[0]);
  const last = separators.at(-1);
  const lastIndex = last ? token.lastIndexOf(last) : -1;
  const digitsAfter = lastIndex === -1 ? 0 : token.length - lastIndex - 1;

  const isGrouping =
    last !== undefined &&
    new Set(separators).size === 1 &&
    (separators.length > 1 || (last === thousands && digitsAfter === THOUSANDS_GROUP_DIGITS));

  const decimals = last === undefined || isGrouping ? 0 : digitsAfter;
  const integerPart = decimals === 0 ? token : token.slice(0, lastIndex);
  const digits = `${integerPart.replaceAll(/[.,]/gu, "")}${decimals > 0 ? `.${token.slice(lastIndex + 1)}` : ""}`;
  const value = Number(digits);

  return Number.isFinite(value) ? { decimals, value } : null;
}

function toExpression(text: string, language: string): string | null {
  const tokens = [...text.matchAll(NUMBER_TOKEN)].map((match) => match[0]);
  const parsed = tokens.map((token) => parseNumber(token, language));

  if (parsed.some((number) => number === null)) {
    return null;
  }

  const values = parsed.map((number) => String(number?.value));

  return text
    .split(NUMBER_TOKEN)
    .map((piece, index) => `${piece}${values[index] ?? ""}`)
    .join("");
}

function getLeftExpression(segment: string): string | null {
  const run = TRAILING_ARITHMETIC.exec(segment)?.[0] ?? "";
  const leading = LEADING_PUNCTUATION.exec(run)?.[0].length ?? 0;
  const expression = run.slice(leading).trim();
  const before = segment[segment.length - run.length + leading - 1] ?? "";

  if (!BINARY_OPERATION.test(expression) || ATTACHED_BEFORE.test(before)) {
    return null;
  }

  return expression;
}

function getRightNumber(segment: string): string | null {
  const match = LEADING_NUMBER.exec(segment);
  const after = match?.groups?.after ?? "";
  const rest = segment.slice(match?.[0].length ?? 0).trimStart();

  if (!match?.groups?.number || ATTACHED_AFTER.test(after) || /^[+\-*/^]/u.test(rest)) {
    return null;
  }

  return match.groups.number;
}

function checkEquation({
  approximate,
  language,
  left,
  right,
}: {
  approximate: boolean;
  language: string;
  left: string;
  right: string;
}): string | null {
  const expression = toExpression(left, language);
  const stated = parseNumber(right.replace(/^-/u, ""), language);

  if (!expression || !stated) {
    return null;
  }

  const result = evaluateFormula(expression, {});
  const statedValue = right.startsWith("-") ? -stated.value : stated.value;

  if (!result.ok) {
    return null;
  }

  const rounding = ROUNDING_SLACK * 10 ** -stated.decimals;
  const slack = approximate ? Math.abs(result.value) * APPROXIMATE_RELATIVE_SLACK : 0;
  const allowed = Math.max(rounding, slack) + Math.abs(statedValue) * FLOAT_SLACK;

  return Math.abs(result.value - statedValue) <= allowed
    ? null
    : `"${left} = ${right}" is wrong: it gives ${Number(result.value.toPrecision(10))}.`;
}

export function findArithmeticErrors({
  language,
  text,
}: {
  language: string;
  text: string;
}): string[] {
  const parts = normalizeMath(text).split(EQUALS);

  return parts.flatMap((segment, index) => {
    const sign = parts[index + 1];
    const next = parts[index + 2];

    if (index % 2 !== 0 || sign === undefined || next === undefined) {
      return [];
    }

    const left = getLeftExpression(segment);
    const right = getRightNumber(next);

    if (!left || !right) {
      return [];
    }

    const error = checkEquation({ approximate: sign === "≈", language, left, right });
    return error ? [error] : [];
  });
}

export function readNumbers({ language, text }: { language: string; text: string }): number[] {
  return [...normalizeMath(text).matchAll(NUMBER_TOKEN)].flatMap(
    (match) => parseNumber(match[0], language)?.value ?? [],
  );
}
