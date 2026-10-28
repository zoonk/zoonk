import {
  type NumericEntry,
  numericEntrySchema,
  optionSelectSchema,
} from "@zoonk/ai/tasks/v2/items/schemas";
import { apportion } from "@zoonk/utils/apportion";
import { isJsonObject } from "@zoonk/utils/json";
import { type ExamStructure, isFormatShare } from "../../library/exams/blueprint-contract";
import { getExamFormats } from "../../library/exams/exam-choice-format";
import { ANY_NUMBER } from "../../library/items/_utils/numeric-entry";
import { type ExamAnswerFormat } from "../../lookahead/exam-answer-formats";

type MockFormatWriter =
  | { kind: "quick" }
  | { answerFormat: ExamAnswerFormat; kind: "item" }
  | { kind: "bankOnly" };

export type MockFormat = { key: string; share: number; writer: MockFormatWriter };

const CHOICE_KEY = "choice";
const TYPED_KEY = "typed";

export const ONE_PICK_MIX: readonly MockFormat[] = [
  { key: CHOICE_KEY, share: 1, writer: { kind: "quick" } },
];

function toNumericKey(entry: NumericEntry): string {
  return `numeric:${entry.kind}:${entry.places ?? ""}`;
}

function toPicksKey(select: ExamAnswerFormat["select"]): string {
  return `picks:${select}`;
}

type ExamFormat = ExamStructure["formats"][number];
type StatedFormat = { key: string; stated: number | null; writer: MockFormatWriter };

function toStatedFormat({
  format,
  isChoice,
}: {
  format: ExamFormat;
  isChoice: boolean;
}): StatedFormat | null {
  const stated = isFormatShare(format.share) ? format.share : null;

  if (format.kind === "multipleChoice" && format.select && format.select !== 1) {
    const answerFormat = { entry: null, format: "multipleChoice", select: format.select } as const;
    return { key: toPicksKey(format.select), stated, writer: { answerFormat, kind: "item" } };
  }

  if (format.kind === "numeric") {
    const entry = format.entry ?? ANY_NUMBER;
    const answerFormat = { entry, format: "numeric", select: null } as const;
    return { key: toNumericKey(entry), stated, writer: { answerFormat, kind: "item" } };
  }

  if (format.kind === "shortAnswer") {
    return { key: TYPED_KEY, stated, writer: { kind: "bankOnly" } };
  }

  return isChoice ? { key: CHOICE_KEY, stated, writer: { kind: "quick" } } : null;
}

function toWeights(formats: readonly StatedFormat[]): number[] {
  const stated = formats.reduce((sum, format) => sum + (format.stated ?? 0), 0);
  const unstated = formats.filter((format) => format.stated === null).length;
  const rest = stated === 0 ? 1 : Math.max(0, 1 - stated);

  return formats.map((format) => format.stated ?? rest / unstated);
}

export function getMockFormatMix(
  structure: Pick<ExamStructure, "formats" | "pastOptions"> | null,
): MockFormat[] {
  const formats = structure ? getExamFormats(structure) : [];

  const choiceAt = formats.findIndex(
    (format) =>
      format.kind === "trueFalse" ||
      (format.kind === "multipleChoice" && (!format.select || format.select === 1)),
  );

  const asked = formats
    .flatMap((format, index) => toStatedFormat({ format, isChoice: index === choiceAt }) ?? [])
    .filter((format, index, all) => all.findIndex((other) => other.key === format.key) === index);

  if (asked.length === 0) {
    return [...ONE_PICK_MIX];
  }

  const weights = toWeights(asked);
  const sum = weights.reduce((acc, weight) => acc + weight, 0);

  return asked.map(({ key, writer }, index) => ({
    key,
    share: sum > 0 ? (weights[index] ?? 0) / sum : 1 / asked.length,
    writer,
  }));
}

export function getFormatMixSource(
  structure: Pick<ExamStructure, "formats" | "pastOptions"> | null,
): "even" | "notice" | null {
  if (getMockFormatMix(structure).length <= 1) {
    return null;
  }

  return structure?.formats.some((format) => isFormatShare(format.share)) ? "notice" : "even";
}

export function getItemFormatKey({
  item,
  mix,
}: {
  item: { content: unknown; format: string };
  mix: readonly MockFormat[];
}): string | null {
  const keys = mix.map((format) => format.key);
  const content = isJsonObject(item.content) ? item.content : {};
  const firstOf = (prefix: string) => keys.find((key) => key.startsWith(prefix)) ?? null;

  if (item.format === "typed") {
    return keys.includes(TYPED_KEY) ? TYPED_KEY : null;
  }

  if (item.format === "numeric") {
    const own = toNumericKey(numericEntrySchema.safeParse(content.entry).data ?? ANY_NUMBER);
    return keys.includes(own) ? own : firstOf("numeric:");
  }

  const select = optionSelectSchema.safeParse(content.select).data ?? 1;

  if (item.format === "multipleChoice" && select !== 1) {
    const own = toPicksKey(select);
    return keys.includes(own) ? own : firstOf("picks:");
  }

  return keys.includes(CHOICE_KEY) ? CHOICE_KEY : null;
}

export function getFormatQuotas({
  mix,
  wanted,
}: {
  mix: readonly MockFormat[];
  wanted: number;
}): Map<string, number> {
  const counts = apportion({ total: wanted, weights: mix.map((format) => format.share) });
  return new Map(mix.map((format, index) => [format.key, counts[index] ?? 0]));
}
