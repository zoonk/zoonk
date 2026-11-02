const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/gu;

const CALCULATION_PATTERN = /[=+×÷*/]|\s[-−]\s/u;

const WORD_PATTERN = /\p{L}/u;

const MAX_WORKED_OPTIONS = 1;

const TOLERANCE = 0.005;

const THOUSANDS_GROUP = /^\d{1,3}(?:[.,]\d{3})+$/u;

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

function getOneStepResults(values: readonly number[]): number[] {
  return values.flatMap((a, i) =>
    values.flatMap((b, j) => (i === j ? [] : [a + b, a - b, a * b, b === 0 ? a : a / b])),
  );
}

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
