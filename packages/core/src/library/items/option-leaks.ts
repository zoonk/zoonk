/** A number as written: digits with dots or commas between them ("12", "2,50", "1.157,63"). */
const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/gu;

/** An option written as a calculation ("12 ÷ 6 = 2") asks to judge the work, so it may show it. */
const CALCULATION_PATTERN = /[=+×÷*/]|\s[-−]\s/u;

/** A letter in any language: a word between a choice's number and a value makes it a label. */
const WORD_PATTERN = /\p{L}/u;

/** Options that print the values deciding the answer: past this many, the learner only compares. */
const MAX_WORKED_OPTIONS = 1;

const TOLERANCE = 0.005;

/** A group of three digits after one separator may be thousands ("1.000") or decimals. */
const THOUSANDS_GROUP = /^\d{1,3}(?:[.,]\d{3})+$/u;

/** A number's possible values: "2,50" and "2.50" are 2.5; "1.000" may be 1000 or 1. */
function readValues(token: string): number[] {
  const lastSeparator = Math.max(token.lastIndexOf(","), token.lastIndexOf("."));

  if (lastSeparator === -1) {
    return [Number(token)];
  }

  const whole = token.slice(0, lastSeparator).replaceAll(/[.,]/gu, "");
  const decimal = Number(`${whole}.${token.slice(lastSeparator + 1)}`);

  return THOUSANDS_GROUP.test(token)
    ? [decimal, Number(token.replaceAll(/[.,]/gu, ""))]
    : [decimal];
}

type NumberInText = { end: number; start: number; values: number[] };

function readNumbers(text: string): NumberInText[] {
  return [...text.matchAll(NUMBER_PATTERN)].map((match) => ({
    end: match.index + match[0].length,
    start: match.index,
    values: readValues(match[0]),
  }));
}

function isNear(a: number, b: number): boolean {
  return Math.abs(a - b) < TOLERANCE;
}

/** What one step of arithmetic on two of the stem's numbers gives. */
function getOneStepResults(values: readonly number[]): number[] {
  return values.flatMap((a, i) =>
    values.flatMap((b, j) => (i === j ? [] : [a + b, a - b, a * b, b === 0 ? a : a / b])),
  );
}

/**
 * Whether an option names a choice from the stem and then a value worked out from the stem's
 * numbers, such as "The pack of 6, at $2.00 each" when the stem gives $12.00 for 6: the learner no
 * longer needs to compute it. Words between the two tell a labeled choice from an answer that is
 * itself a value, like a point "(6, 4)".
 */
function showsWorkedValue({
  option,
  results,
  stem,
}: {
  option: string;
  results: readonly number[];
  stem: readonly number[];
}): boolean {
  if (CALCULATION_PATTERN.test(option)) {
    return false;
  }

  const numbers = readNumbers(option);

  const isFromStem = ({ values }: NumberInText) =>
    values.some((value) => stem.some((given) => isNear(given, value)));

  const isWorked = (number: NumberInText) =>
    !isFromStem(number) &&
    number.values.some((value) => results.some((result) => isNear(result, value)));

  return numbers.some(
    (label, index) =>
      isFromStem(label) &&
      numbers
        .slice(index + 1)
        .some(
          (value) => isWorked(value) && WORD_PATTERN.test(option.slice(label.end, value.start)),
        ),
  );
}

/**
 * Whether a multiple-choice question's options print the values that decide it: two or more
 * options each name a choice from the question with the result of working it out ("The pack of
 * 6, at $2.00 each" and "The pack of 4, at $2.50 each"). The question then tests reading, not the
 * skill.
 */
export function optionsShowWorkedValues({
  options,
  stem,
}: {
  options: readonly string[];
  stem: string;
}): boolean {
  const stemValues = readNumbers(stem).flatMap((number) => number.values);
  const results = getOneStepResults(stemValues);

  const worked = options.filter((option) =>
    showsWorkedValue({ option, results, stem: stemValues }),
  );

  return worked.length > MAX_WORKED_OPTIONS;
}
