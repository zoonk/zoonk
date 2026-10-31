import {
  type NumericEntry,
  type OptionSelect,
  numericEntrySchema,
  optionSelectSchema,
} from "@zoonk/ai/tasks/items/schemas";
import { apportion } from "@zoonk/utils/apportion";
import { isJsonObject } from "@zoonk/utils/json";
import { sumOf } from "@zoonk/utils/number";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { countOptions, getExamFormats } from "../../library/exams/exam-choice-format";
import { isAskedIn } from "../../library/exams/format-sections";
import { isFormatShare } from "../../library/exams/format-shares";
import { describeFormat } from "../../library/exams/format-style";
import { ANY_NUMBER } from "../../library/items/_utils/numeric-entry";
import { listAreaParts } from "./exam-parts";

export type ExamAnswerFormat =
  | { entry: null; format: "multipleChoice"; options: number | null; select: OptionSelect }
  | { entry: NumericEntry; format: "numeric"; options: null; select: null };

export type MockQuickChoice = { kind: "multipleChoice" | "trueFalse"; options: number | null };

/** A quick `choice` of null writes the goal's own quick format with the exam's usual options. */
type MockFormatWriter =
  | { choice: MockQuickChoice | null; kind: "quick" }
  | { answerFormat: ExamAnswerFormat; kind: "item" }
  | { kind: "bankOnly" };

/** `style` describes the exam's formats behind the key, so new questions take their shape. */
export type MockFormat = {
  key: string;
  sections: string[];
  share: number;
  style: string | null;
  writer: MockFormatWriter;
};

const CHOICE_KEY = "choice";
const TYPED_KEY = "typed";

export const ONE_PICK_MIX: readonly MockFormat[] = [
  { key: CHOICE_KEY, sections: [], share: 1, style: null, writer: { choice: null, kind: "quick" } },
];

function toChoiceKey({ kind, options }: MockQuickChoice): string {
  if (kind === "trueFalse") {
    return `${CHOICE_KEY}:tf`;
  }

  return options ? `${CHOICE_KEY}:${options}` : CHOICE_KEY;
}

function toNumericKey(entry: NumericEntry): string {
  return `numeric:${entry.kind}:${entry.places ?? ""}`;
}

export function getChoiceFormatKey(select: OptionSelect | null): string {
  return select === null || select === 1 ? CHOICE_KEY : `picks:${select}`;
}

/** The pick a format's key asks for, as marking rows name it: one pick, or a number of picks. */
export function getFormatSelection(key: string | null): string {
  return key?.startsWith("picks:") ? key : CHOICE_KEY;
}

type ExamFormat = ExamStructure["formats"][number];

type StatedFormat = {
  format: ExamFormat;
  key: string;
  sections: string[];
  writer: MockFormatWriter;
};

function toWriter(format: ExamFormat): Pick<StatedFormat, "key" | "writer"> | null {
  if (format.kind === "multipleChoice" && format.select && format.select !== 1) {
    const { options, select } = format;
    const answerFormat = { entry: null, format: "multipleChoice", options, select } as const;
    return { key: getChoiceFormatKey(select), writer: { answerFormat, kind: "item" } };
  }

  if (format.kind === "numeric") {
    const entry = format.entry ?? ANY_NUMBER;
    const answerFormat = { entry, format: "numeric", options: null, select: null } as const;
    return { key: toNumericKey(entry), writer: { answerFormat, kind: "item" } };
  }

  if (format.kind === "shortAnswer") {
    return { key: TYPED_KEY, writer: { kind: "bankOnly" } };
  }

  if (format.kind === "multipleChoice" || format.kind === "trueFalse") {
    const choice = {
      kind: format.kind,
      options: format.kind === "trueFalse" ? null : format.options,
    };

    return { key: toChoiceKey(choice), writer: { choice, kind: "quick" } };
  }

  return null;
}

function toStatedFormat(format: ExamFormat): StatedFormat | null {
  const writer = toWriter(format);
  return writer && { ...writer, format, sections: format.sections ?? [] };
}

function toWeights(formats: readonly StatedFormat[]): number[] {
  const shares = formats.map(({ format }) => (isFormatShare(format.share) ? format.share : null));
  const stated = shares.reduce<number>((sum, share) => sum + (share ?? 0), 0);
  const unstated = shares.filter((share) => share === null).length;
  const rest = stated === 0 ? 1 : Math.max(0, 1 - stated);

  return shares.map((share) => share ?? rest / unstated);
}

function toMockFormat({
  key,
  members,
  share,
}: {
  key: string;
  members: readonly StatedFormat[];
  share: number;
}): MockFormat {
  const [first] = members;
  const everywhere = members.some((member) => member.sections.length === 0);

  return {
    key,
    sections: everywhere ? [] : [...new Set(members.flatMap((member) => member.sections))],
    share,
    style: [...new Set(members.map((member) => describeFormat(member.format)))].join(" "),
    writer: first?.writer ?? { choice: null, kind: "quick" },
  };
}

/**
 * Formats that answer the same way share a key and its questions. With `parts`, only the formats
 * asked in those parts of the exam; without, the whole exam's.
 */
export function getMockFormatMix(
  structure: ExamStructure | null,
  parts?: readonly string[],
): MockFormat[] {
  const stated = (structure ? getExamFormats(structure) : []).flatMap(
    (format) => toStatedFormat(format) ?? [],
  );

  if (stated.length === 0) {
    return [...ONE_PICK_MIX];
  }

  const asked = parts ? stated.filter((format) => isAskedIn({ format, parts })) : stated;

  const weights = toWeights(asked);
  const total = sumOf(weights);
  const keys = [...new Set(asked.map((format) => format.key))];

  return keys.map((key) => {
    const members = asked.filter((format) => format.key === key);
    const weight = sumOf(members.map((member) => weights[asked.indexOf(member)] ?? 0));

    return toMockFormat({ key, members, share: total > 0 ? weight / total : 1 / keys.length });
  });
}

export function getFormatMixSource(structure: ExamStructure | null): "even" | "notice" | null {
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
    const own = getChoiceFormatKey(select);
    return keys.includes(own) ? own : firstOf("picks:");
  }

  const own = toChoiceKey({
    kind: item.format === "trueFalse" ? "trueFalse" : "multipleChoice",
    options: countOptions(item.content),
  });

  if (keys.includes(own)) {
    return own;
  }

  return keys.includes(CHOICE_KEY) ? CHOICE_KEY : null;
}

/** Every section's quotas so far, so a format only some sections ask keeps its count. */
export function addFormatsWanted({
  quotas,
  wanted,
}: {
  quotas: ReadonlyMap<string, number>;
  wanted: Readonly<Record<string, number>>;
}): Record<string, number> {
  const added = [...quotas].map(([key, count]) => [key, (wanted[key] ?? 0) + count] as const);
  return { ...wanted, ...Object.fromEntries(added) };
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

/** The format as a skill of `area` writes it: null when no part of that area asks it. */
export function getAreaFormat({
  area,
  format,
  structure,
}: {
  area: string | null;
  format: MockFormat;
  structure: ExamStructure | null;
}): MockFormat | null {
  const parts = area ? listAreaParts({ area, structure }) : undefined;
  return getMockFormatMix(structure, parts).find((scoped) => scoped.key === format.key) ?? null;
}
