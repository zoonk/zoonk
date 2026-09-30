import {
  GENERATED_ITEM_SCHEMAS,
  type GeneratedItem,
  type ItemFormat,
  essayRubricRowSchema,
} from "@zoonk/ai/tasks/v2/items/schemas";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { shuffleAnswerOptions, stripOptionLabels } from "../_utils/answer-options";

/**
 * A past exam question copied as printed, where its organizer allows it (see `past-questions.ts`):
 * its options keep the paper's order, and it cites the paper.
 */
const quotedField = { quoted: z.literal(true).optional() };

/** Essays stored before rubric rows had points read as rows without points of their own. */
const storedRubricSchema = z
  .array(essayRubricRowSchema.extend({ points: essayRubricRowSchema.shape.points.default(null) }))
  .min(2);

/**
 * `Item.content` for each format. It is the generated item without the fields
 * that live in their own columns (`format`, and `difficulty`, which real
 * answers recalibrate), so generation and storage share one shape.
 */
const ITEM_CONTENT_SCHEMAS = {
  essay: GENERATED_ITEM_SCHEMAS.essay
    .omit({ difficulty: true, format: true })
    .extend({ rubric: storedRubricSchema }),
  matchPairs: GENERATED_ITEM_SCHEMAS.matchPairs.omit({ difficulty: true, format: true }),
  multipleChoice: GENERATED_ITEM_SCHEMAS.multipleChoice
    .omit({ difficulty: true, format: true })
    .extend({
      ...quotedField,
      /** Rows stored before letters were dropped at write time read without them too. */
      options: GENERATED_ITEM_SCHEMAS.multipleChoice.shape.options.transform(stripOptionLabels),
    }),
  numeric: GENERATED_ITEM_SCHEMAS.numeric.omit({ difficulty: true, format: true }),
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

/** A stored item's format with its content, narrowed together. */
export type ParsedItemContent = {
  [FORMAT in ItemFormat]: { format: FORMAT; content: ItemContentByFormat[FORMAT] };
}[ItemFormat];

/** Whether stored item content is a past exam question copied as printed, shown with its source. */
export function isQuotedItem(content: unknown): boolean {
  return isJsonObject(content) && content.quoted === true;
}

/** Maps a checked item's generated difficulty to the IRT-style scale real answers refine. */
const DIFFICULTY_SCALE = { easy: -1, hard: 1, medium: 0 } as const;

/**
 * Splits a generated item into its stored parts: the content JSON, its format
 * and the starting difficulty that answers later recalibrate. Options never
 * keep a printed letter, since every screen shows its own. A quoted past
 * question keeps its options in the order the paper printed them.
 */
export function toStoredItem(item: GeneratedItem, { quoted = false }: { quoted?: boolean } = {}) {
  const { difficulty, format, ...written } = item;

  const content =
    "options" in written ? { ...written, options: stripOptionLabels(written.options) } : written;

  if (quoted) {
    return {
      content: { ...content, quoted: true },
      difficulty: DIFFICULTY_SCALE[difficulty],
      format,
    };
  }

  const stored =
    "options" in content ? { ...content, options: shuffleAnswerOptions(content.options) } : content;

  return { content: stored, difficulty: DIFFICULTY_SCALE[difficulty], format };
}

/**
 * Reads stored item content for its format. Content is written only after the
 * item checks pass, so a parse failure means corrupted data and throws.
 */
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
