import {
  GENERATED_ITEM_SCHEMAS,
  type GeneratedItem,
  type ItemFormat,
  type NumericEntry,
  type OptionSelect,
  essayRubricRowSchema,
  numericEntrySchema,
  optionSelectSchema,
} from "@zoonk/ai/tasks/v2/items/schemas";
import { lessonVisualSchema } from "@zoonk/ai/tasks/v2/visuals/schema";
import { isJsonObject, mapJsonStrings } from "@zoonk/utils/json";
import { replaceEmDashes } from "@zoonk/utils/string";
import { z } from "zod";
import { shuffleAnswerOptions, stripOptionLabels } from "../_utils/answer-options";
import { ANY_NUMBER } from "./_utils/numeric-entry";

/**
 * A past exam question copied as printed, where its organizer allows it (see `past-questions.ts`):
 * its options keep the paper's order, and it cites the paper.
 */
const quotedField = { quoted: z.literal(true).optional() };

/**
 * Items stored before questions could show a chart, a timeline or a picture read as having none.
 * A picture is only asked for here; the drawn file is linked through `Item.mediaAssetId`.
 */
const storedVisualFields = {
  image: GENERATED_ITEM_SCHEMAS.typed.shape.image.default(null),
  visual: lessonVisualSchema.nullable().default(null),
};

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
      ...storedVisualFields,
      /** Questions stored before fixed orders were shuffled when stored. */
      fixedOrder: z.boolean().default(false),
      /** How many options the learner picks; questions stored before picks had one right option. */
      select: optionSelectSchema.default(1),
    }),
  numeric: GENERATED_ITEM_SCHEMAS.numeric.omit({ difficulty: true, format: true }).extend({
    /** How the answer is typed; math stored before entry rules takes any number. */
    entry: numericEntrySchema.default(ANY_NUMBER),
    otherSolutions: GENERATED_ITEM_SCHEMAS.numeric.shape.otherSolutions.default([]),
  }),
  order: GENERATED_ITEM_SCHEMAS.order.omit({ difficulty: true, format: true }),
  spoken: GENERATED_ITEM_SCHEMAS.spoken.omit({ difficulty: true, format: true }),
  trueFalse: GENERATED_ITEM_SCHEMAS.trueFalse
    .omit({ difficulty: true, format: true })
    .extend({ ...quotedField, ...storedVisualFields }),
  typed: GENERATED_ITEM_SCHEMAS.typed
    .omit({ difficulty: true, format: true })
    .extend(storedVisualFields),
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
 * The support text (`context`) is where excerpts, transcripts and other quoted texts live, and they
 * keep their own punctuation (a transcript's speaker line keeps its em dash as printed); every
 * other field is our own wording.
 */
export function isOwnWording(key: string): boolean {
  return key !== "context";
}

/**
 * Our own wording never uses em dashes, as lesson screens don't (`replaceEmDashes`): a written
 * item loses them everywhere but its support text.
 */
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

/**
 * What the exam's format sets for how an item is answered, stored with it: how many options a
 * multiple-choice learner picks (`select`) and how a numeric answer is typed (`entry`).
 */
export type ItemAnswerFormat = { entry?: NumericEntry; select?: OptionSelect };

/** The answer format a format's content stores: picks for multiple choice, entry for numeric. */
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

/**
 * Splits a generated item into its stored parts: the content JSON, its format
 * and the starting difficulty that answers later recalibrate, with how it's
 * answered (`select`, `entry`). Options never keep a printed letter, since
 * every screen shows its own. A quoted past question keeps its options in the
 * order the paper printed them, and so does a fixed set of options (True,
 * False, Not given); other options are shuffled once. Em dashes leave our own
 * wording; a quoted past question and an item that cites the source it
 * reproduces (a statute drill) keep every word as the source wrote it.
 */
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
