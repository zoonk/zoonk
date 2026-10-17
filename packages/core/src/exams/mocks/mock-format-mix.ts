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

/**
 * How a format's questions are written when the bank is short of them before a mock: the exam's
 * one-pick format by the quick writer placement uses too (`quick`), several picks or a number
 * typed in by the item writer (`item`), and typed words not at all (`bankOnly`): a mock asks the
 * ones the bank holds, written with the texts they belong to.
 */
type MockFormatWriter =
  | { kind: "quick" }
  | { answerFormat: ExamAnswerFormat; kind: "item" }
  | { kind: "bankOnly" };

/** One of the exam's objective formats as a mock asks it: its share of the mock's questions. */
export type MockFormat = { key: string; share: number; writer: MockFormatWriter };

/** The exam's one-pick format: one right option, or an assertion judged right or wrong. */
const CHOICE_KEY = "choice";
const TYPED_KEY = "typed";

/** The exam's one-pick format as the whole of a mock: an exam that lists no other. */
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

/** The format as a mock asks it, or null for one it never fills with questions (an essay). */
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

/**
 * Each format's weight: the notice's share where it states one; the formats it gives none share
 * what's left equally, and all of them equally when it states none.
 */
function toWeights(formats: readonly StatedFormat[]): number[] {
  const stated = formats.reduce((sum, format) => sum + (format.stated ?? 0), 0);
  const unstated = formats.filter((format) => format.stated === null).length;
  const rest = stated === 0 ? 1 : Math.max(0, 1 - stated);

  return formats.map((format) => format.stated ?? rest / unstated);
}

/**
 * The exam's objective formats a mock asks, in the notice's order, each with its share of the
 * mock's questions as the notice states it (JEE Main's 20 multiple-choice and 5 numeric questions
 * per subject), or an equal share when it doesn't say (`hasStatedMix` tells which). The exam's
 * first one-pick format stands for them all; an exam that lists none, or no blueprint, asks one
 * pick only.
 */
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

/**
 * Where a mock's mix of formats comes from: the notice's counts (`notice`, the formats it doesn't
 * count sharing what's left), an even split when it counts none (`even`), or null for an exam of
 * one format.
 */
export function getFormatMixSource(
  structure: Pick<ExamStructure, "formats" | "pastOptions"> | null,
): "even" | "notice" | null {
  if (getMockFormatMix(structure).length <= 1) {
    return null;
  }

  return structure?.formats.some((format) => isFormatShare(format.share)) ? "notice" : "even";
}

/**
 * Which of the mix's formats a bank question is in: a typed word, a number (in its own answer
 * box, else any of the exam's), several picks, else the exam's one-pick format. Null for one the
 * mix doesn't ask, which a mock asks only to fill its size.
 */
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

/** How many of a section's `wanted` questions each of the mix's formats asks, by key. */
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
