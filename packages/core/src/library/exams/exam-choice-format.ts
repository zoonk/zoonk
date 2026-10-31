import { type ItemFormat } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type ExamStructure } from "./blueprint-contract";

type ExamFormat = ExamStructure["formats"][number];

export type ExamChoiceFormat = ExamFormat & { kind: "multipleChoice" | "trueFalse" };

function isChoiceFormat(format: ExamFormat): format is ExamChoiceFormat {
  return format.kind === "multipleChoice" || format.kind === "trueFalse";
}

function isOnePick(format: ExamChoiceFormat): boolean {
  return !format.select || format.select === 1;
}

type FormatsOf = Pick<ExamStructure, "formats" | "pastOptions">;

export function getExamFormats(structure: FormatsOf): ExamFormat[] {
  const pastOptions = structure.pastOptions?.options ?? null;

  return structure.formats.map((format) =>
    format.kind === "multipleChoice" && format.options === null && pastOptions !== null
      ? { ...format, options: pastOptions }
      : format,
  );
}

export function getExamChoiceFormats(structure: FormatsOf | null): ExamChoiceFormat[] {
  return structure ? getExamFormats(structure).filter((format) => isChoiceFormat(format)) : [];
}

/** Every part of the exam asks a format the documents tie to none. */
function countSections(format: ExamFormat): number {
  return format.sections?.length || Number.MAX_SAFE_INTEGER;
}

/**
 * The one-pick format the exam asks most widely, whose shape quick questions take: a format one
 * section asks (comparing two quantities) would be wrong for every other section's skills.
 */
export function getExamChoiceFormat(structure: FormatsOf | null): ExamChoiceFormat | null {
  const choices = getExamChoiceFormats(structure);
  const onePicks = choices.filter((format) => isOnePick(format));

  const [widest] = onePicks.toSorted(
    (first, second) =>
      countSections(second) - countSections(first) || (second.share ?? 0) - (first.share ?? 0),
  );

  return widest ?? choices[0] ?? null;
}

export function countOptions(content: unknown): number | null {
  return isJsonObject(content) && Array.isArray(content.options) ? content.options.length : null;
}

type ChoiceShape = Pick<ExamChoiceFormat, "kind" | "options">;

type ChoiceFit = {
  choices: readonly ChoiceShape[];
  item: { content: unknown; format: ItemFormat };
};

function fitsOptions({ choice, item }: { choice: ChoiceShape; item: ChoiceFit["item"] }): boolean {
  return (
    choice.kind !== "multipleChoice" ||
    !choice.options ||
    item.format !== "multipleChoice" ||
    countOptions(item.content) === choice.options
  );
}

export function fitsExamOptions({ choices, item }: ChoiceFit): boolean {
  const multipleChoice = choices.filter((choice) => choice.kind === "multipleChoice");

  return (
    multipleChoice.length === 0 || multipleChoice.some((choice) => fitsOptions({ choice, item }))
  );
}

export function fitsExamChoice({ choices, item }: ChoiceFit): boolean {
  if (choices.length === 0 || item.format === "typed") {
    return true;
  }

  return choices.some((choice) => item.format === choice.kind && fitsOptions({ choice, item }));
}
