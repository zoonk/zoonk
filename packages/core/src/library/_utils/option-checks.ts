import { normalizeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { parseLocalizedNumber } from "@zoonk/utils/localized-number";
import { findMarkdownTables } from "@zoonk/utils/markdown-table";
import { normalizeString } from "@zoonk/utils/string";

const MARKS = /[*_`~"'“”‘’«»()[\]{}.,;:!?¿¡]/gu;

const NUMBER_WITH_UNIT = /^(?<before>\D*?)\s*(?<number>[+\-−]?\d[\d.,\s]*?)\s*(?<after>\D*)$/u;

function toWords(text: string): string {
  return normalizeString(text.replaceAll(MARKS, " "));
}

function toNumberKey({ language, text }: { language: string; text: string }): string | null {
  const groups = NUMBER_WITH_UNIT.exec(text.trim())?.groups;

  const value = groups?.number
    ? parseLocalizedNumber({ locale: language, text: groups.number })
    : null;

  return groups && value !== null
    ? `${toWords(groups.before ?? "")}|${value}|${toWords(groups.after ?? "")}`
    : null;
}

function isSameAnswer({
  first,
  language,
  second,
}: {
  first: string;
  language: string;
  second: string;
}): boolean {
  const firstNumber = toNumberKey({ language, text: first });

  return (
    toWords(first) === toWords(second) ||
    (firstNumber !== null && firstNumber === toNumberKey({ language, text: second }))
  );
}

export function findEquivalentOptions({
  language,
  texts,
}: {
  language: string;
  texts: readonly string[];
}): string[] {
  return texts.flatMap((text, index) =>
    texts
      .slice(index + 1)
      .filter((other) => isSameAnswer({ first: text, language, second: other }))
      .map(
        (other) =>
          `Options "${text}" and "${other}" say the same thing; make each option a different answer.`,
      ),
  );
}

export function dropEquivalentOptions<TOption extends { isCorrect: boolean; text: string }>({
  language,
  options,
}: {
  language: string;
  options: readonly TOption[];
}): TOption[] {
  const isTwin = (first: TOption, second: TOption) =>
    isSameAnswer({ first: first.text, language, second: second.text });

  return options.flatMap((option, index) => {
    if (options.findIndex((other) => isTwin(other, option)) !== index) {
      return [];
    }

    const right = options.find((other) => other.isCorrect && isTwin(other, option));
    return [option.isCorrect || !right ? option : right];
  });
}

const LETTER = /^[A-H]$/u;
const ROMAN = /^(?:I{1,3}|IV|VI{0,3}|IX|X)$/u;

const LABELLED_LINE = /^\s*\(?(?<label>[A-H]|I{1,3}|IV|VI{0,3}|IX|X)(?:[.)]|\s+[-–]|:)\s+\S/u;

const LABEL_OPTION = /^(?:\p{L}+\s+)?(?<label>[A-H]|I{1,3}|IV|VI{0,3}|IX|X)(?:[.,:]|\s+[-–]|$)/u;

const ROMAN_MENTION = /(?<![\p{L}\p{N}])(?:I{1,3}|IV|VI{0,3}|IX|X)(?![\p{L}\p{N}])/gu;

function stripMarks(cell: string): string {
  return cell.replaceAll(/[*_`]/gu, "").trim();
}

function readTableLabels(text: string): string[] {
  return findMarkdownTables(text).flatMap(({ rows }) => {
    const labels = rows.map((row) => stripMarks(row[0] ?? ""));

    const isLabelColumn =
      labels.length > 1 && labels.every((label) => LETTER.test(label) || ROMAN.test(label));

    return isLabelColumn ? labels : [];
  });
}

function readLineLabels(text: string): string[] {
  const labels = text.split(/\r?\n/u).flatMap((line) => {
    const label = LABELLED_LINE.exec(line)?.groups?.label;
    return label ? [label] : [];
  });

  return labels.length > 1 ? labels : [];
}

function readOptionLabel(option: string): string | null {
  return LABEL_OPTION.exec(stripMarks(option))?.groups?.label ?? null;
}

function describeLabels(labels: Iterable<string>): string {
  return [...labels].join(", ");
}

function findLetterProblems({
  dataLabels,
  options,
}: {
  dataLabels: ReadonlySet<string>;
  options: readonly string[];
}): string[] {
  const labels = options.map((option) => readOptionLabel(option));
  const letters = labels.flatMap((label) => (label !== null && LETTER.test(label) ? [label] : []));

  const unknown = letters.flatMap((letter) =>
    dataLabels.has(letter)
      ? []
      : [
          `An option names "${letter}", which the data doesn't list (${describeLabels(dataLabels)}).`,
        ],
  );

  const allLabels = labels.every((label) => label !== null);
  const left = [...dataLabels].filter((label) => LETTER.test(label) && !letters.includes(label));

  return [
    ...unknown,
    ...(allLabels && left.length > 0
      ? [
          `The data lists ${describeLabels(dataLabels)} but the options offer only ${describeLabels(letters)}: ${describeLabels(left)} can't be picked.`,
        ]
      : []),
  ];
}

function findRomanProblems({
  dataLabels,
  options,
}: {
  dataLabels: ReadonlySet<string>;
  options: readonly string[];
}): string[] {
  const mentioned = new Set(options.flatMap((option) => option.match(ROMAN_MENTION) ?? []));

  return [...mentioned].flatMap((label) =>
    dataLabels.has(label)
      ? []
      : [
          `An option names "${label}", which the data doesn't list (${describeLabels(dataLabels)}).`,
        ],
  );
}

export function findOptionDataProblems({
  data,
  options,
}: {
  data: readonly (string | null | undefined)[];
  options: readonly string[];
}): string[] {
  const text = data.filter(Boolean).join("\n\n");
  const labels = [...readTableLabels(text), ...readLineLabels(text)];
  const letters = new Set(labels.filter((label) => LETTER.test(label)));
  const romans = new Set(labels.filter((label) => ROMAN.test(label) && !LETTER.test(label)));

  return [
    ...(letters.size > 0 ? findLetterProblems({ dataLabels: letters, options }) : []),
    ...(romans.size > 0 ? findRomanProblems({ dataLabels: romans, options }) : []),
  ];
}

function fromLatex(text: string): string {
  return text.replaceAll(/\\(?:times|cdot)/gu, " × ").replaceAll(/[$\\{}]/gu, " ");
}

function says({ accepted, sample }: { accepted: string; sample: string }): boolean {
  const key = normalizeTypedAnswer(fromLatex(accepted));
  return Boolean(key) && ` ${normalizeTypedAnswer(fromLatex(sample))} `.includes(` ${key} `);
}

export function findAnswerKeyProblems({
  acceptedAnswers,
  sampleAnswer,
}: {
  acceptedAnswers: readonly string[];
  sampleAnswer: string;
}): string[] {
  if (
    acceptedAnswers.length === 0 ||
    acceptedAnswers.some((accepted) => says({ accepted, sample: sampleAnswer }))
  ) {
    return [];
  }

  return [
    `The sample answer gives none of the accepted answers (${acceptedAnswers.join(", ")}); make them agree.`,
  ];
}
