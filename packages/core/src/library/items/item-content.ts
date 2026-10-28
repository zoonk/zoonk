import {
  GENERATED_ITEM_SCHEMAS,
  type GeneratedItem,
  type ItemFormat,
  type NumericEntry,
  type OptionSelect,
  numericEntrySchema,
  optionSelectSchema,
} from "@zoonk/ai/tasks/v2/items/schemas";
import { isJsonObject, mapJsonStrings } from "@zoonk/utils/json";
import { replaceEmDashes } from "@zoonk/utils/string";
import { z } from "zod";
import { shuffleAnswerOptions, stripOptionLabels } from "../_utils/answer-options";
import { ANY_NUMBER } from "./_utils/numeric-entry";

const quotedField = { quoted: z.literal(true).optional() };

const ITEM_CONTENT_SCHEMAS = {
  essay: GENERATED_ITEM_SCHEMAS.essay.omit({ difficulty: true, format: true }),
  matchPairs: GENERATED_ITEM_SCHEMAS.matchPairs.omit({ difficulty: true, format: true }),
  multipleChoice: GENERATED_ITEM_SCHEMAS.multipleChoice
    .omit({ difficulty: true, format: true })
    .extend({ ...quotedField, select: optionSelectSchema }),
  numeric: GENERATED_ITEM_SCHEMAS.numeric
    .omit({ difficulty: true, format: true })
    .extend({ entry: numericEntrySchema }),
  order: GENERATED_ITEM_SCHEMAS.order.omit({ difficulty: true, format: true }),
  spoken: GENERATED_ITEM_SCHEMAS.spoken.omit({ difficulty: true, format: true }),
  trueFalse: GENERATED_ITEM_SCHEMAS.trueFalse
    .omit({ difficulty: true, format: true })
    .extend(quotedField),
  typed: GENERATED_ITEM_SCHEMAS.typed.omit({ difficulty: true, format: true }),
} as const satisfies Record<ItemFormat, z.ZodType>;

type ItemContentByFormat = {
  [FORMAT in ItemFormat]: z.infer<(typeof ITEM_CONTENT_SCHEMAS)[FORMAT]>;
};

export type ParsedItemContent = {
  [FORMAT in ItemFormat]: { format: FORMAT; content: ItemContentByFormat[FORMAT] };
}[ItemFormat];

export function isQuotedItem(content: unknown): boolean {
  return isJsonObject(content) && content.quoted === true;
}

const DIFFICULTY_SCALE = { easy: -1, hard: 1, medium: 0 } as const;

export function isOwnWording(key: string): boolean {
  return key !== "context";
}

function replaceOwnEmDashes<Content extends Record<string, unknown>>(content: Content): Content {
  const replaced = Object.fromEntries(
    Object.entries(content).map(([key, value]) => [
      key,
      isOwnWording(key) ? mapJsonStrings(value, replaceEmDashes) : value,
    ]),
  );

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only strings change, so the content keeps its shape.
  return replaced as Content;
}

export type ItemAnswerFormat = { entry?: NumericEntry; select?: OptionSelect };

function withAnswerFormat<Content extends object>({
  content,
  entry = ANY_NUMBER,
  format,
  select = 1,
}: ItemAnswerFormat & { content: Content; format: ItemFormat }) {
  if (format === "multipleChoice") {
    return { ...content, select };
  }

  return format === "numeric" ? { ...content, entry } : content;
}

export function toStoredItem(
  item: GeneratedItem,
  {
    citesSource = false,
    quoted = false,
    ...answerFormat
  }: ItemAnswerFormat & { citesSource?: boolean; quoted?: boolean } = {},
) {
  const { difficulty, format, ...generated } = item;
  const written = quoted || citesSource ? generated : replaceOwnEmDashes(generated);

  const labeled =
    "options" in written ? { ...written, options: stripOptionLabels(written.options) } : written;

  const content = withAnswerFormat({ ...answerFormat, content: labeled, format });

  if (quoted) {
    return {
      content: { ...content, quoted: true },
      difficulty: DIFFICULTY_SCALE[difficulty],
      format,
    };
  }

  const keepsOrder = "fixedOrder" in content && content.fixedOrder;

  const stored =
    "options" in content && !keepsOrder
      ? { ...content, options: shuffleAnswerOptions(content.options) }
      : content;

  return { content: stored, difficulty: DIFFICULTY_SCALE[difficulty], format };
}

/** Throws on invalid stored content, which indicates corrupted data. */
export function parseItemContent({
  content,
  format,
}: {
  content: unknown;
  format: ItemFormat;
}): ParsedItemContent {
  const parsed: unknown = ITEM_CONTENT_SCHEMAS[format].parse(content);

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The schema was picked by `format`, so the parsed content belongs to that format.
  return { content: parsed, format } as ParsedItemContent;
}
