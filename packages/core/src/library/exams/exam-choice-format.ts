import { type ItemFormat } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type ExamStructure } from "./blueprint-contract";

type ExamFormat = ExamStructure["formats"][number];

export type ExamChoiceFormat = ExamFormat & { kind: "multipleChoice" | "trueFalse" };

function isChoiceFormat(format: ExamFormat): format is ExamChoiceFormat {
  return format.kind === "multipleChoice" || format.kind === "trueFalse";
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

export function getExamChoiceFormat(structure: FormatsOf | null): ExamChoiceFormat | null {
  return structure
    ? (getExamFormats(structure).find((format) => isChoiceFormat(format)) ?? null)
    : null;
}

function countOptions(content: unknown): number | null {
  return isJsonObject(content) && Array.isArray(content.options) ? content.options.length : null;
}

type ChoiceFit = {
  choice: ExamChoiceFormat | null;
  item: { content: unknown; format: ItemFormat };
};

export function fitsExamOptions({ choice, item }: ChoiceFit): boolean {
  return (
    choice?.kind !== "multipleChoice" ||
    !choice.options ||
    item.format !== "multipleChoice" ||
    countOptions(item.content) === choice.options
  );
}

export function fitsExamChoice({ choice, item }: ChoiceFit): boolean {
  if (!choice || item.format === "typed") {
    return true;
  }

  return item.format === choice.kind && fitsExamOptions({ choice, item });
}
