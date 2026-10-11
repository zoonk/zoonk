import { numericEntrySchema, optionSelectSchema } from "@zoonk/ai/tasks/v2/items/schemas";
import { lessonVisualSchema } from "@zoonk/ai/tasks/v2/visuals/schema";
import { z } from "zod";

export const errorSchema = z
  .object({
    error: z.object({
      code: z
        .string()
        .meta({
          description:
            "Stable machine-readable error code. Clients must preserve unknown codes for forward compatibility.",
          examples: ["VALIDATION_ERROR"],
        }),
      details: z.unknown().optional().meta({ description: "Additional error details" }),
      message: z.string().meta({ description: "Error message" }),
    }),
  })
  .meta({ description: "Standard error response", id: "Error" });

export const paginationSchema = z
  .object({
    hasMore: z.boolean().meta({ description: "Whether more results exist" }),
    nextCursor: z.string().nullable().meta({ description: "Cursor for next page" }),
  })
  .meta({ id: "Pagination" });

/** A question's dated "Sources" chip: the passage it quotes and the document it comes from. */
export const itemCitationSchema = z
  .object({
    checkedAt: z.iso
      .datetime()
      .nullable()
      .meta({
        description:
          'When the source was last fetched and found current ("Checked Sep 2026"); null when the passage has no stored source',
      }),
    publisher: z.string().nullable(),
    text: z
      .string()
      .meta({ description: 'The passage it quotes, such as "Lei nº 8.112, Art. 13"' }),
    title: z.string().nullable().meta({ description: "The source document's title" }),
    url: z.string().nullable().meta({ description: "The official text, when it's online" }),
  })
  .nullable();

/**
 * The picture a question is about (a diagram, a map, a geometry figure), drawn and checked before
 * the question was stored; null when the question shows none.
 */
export const questionImageSchema = z
  .object({
    alt: z.string().meta({ description: "What the picture shows, for screen readers" }),
    height: z.int().nullable(),
    url: z.string(),
    width: z.int().nullable(),
  })
  .meta({ description: "Show it with the question: its words point at it", id: "QuestionImage" })
  .nullable();

/**
 * A chart or timeline a question reads, drawn by the app from its data (the same shape lesson
 * screens use); null when the question shows none.
 */
export const questionVisualSchema = lessonVisualSchema
  .meta({
    description:
      "A bar or line chart (categories with up to three series of values) or a timeline of dated events, drawn from its data",
    id: "LessonVisual",
  })
  .nullable();

/** How many options a multiple-choice question asks the learner to pick. */
export const questionSelectSchema = optionSelectSchema.meta({
  description:
    'How many options to pick: 1 (answer with `selectedIndex`), an exact number ("choose two") or "all" ("select all that apply"), answered with `selectedIndexes`',
  id: "QuestionSelect",
});

/** A math question's unit beside its answer box, where the question's language writes it. */
export const questionUnitSchema = z
  .object({
    position: z
      .enum(["prefix", "suffix"])
      .meta({ description: "Where the unit goes: before the number for money (R$ 45)" }),
    symbol: z.string(),
  })
  .nullable()
  .meta({ description: "A math problem's unit, shown next to the answer field" });

/** How a math question's answer box takes the number, as the exam's answer grid does. */
export const questionEntrySchema = numericEntrySchema.meta({
  description:
    "How the answer is typed: `number` (any number, graded with a tolerance), `integer` (a whole number), `decimals` (rounded or cut to `places` decimal places) or `fraction` (a fraction such as 2/3, sent as its value, or a decimal with at least three places)",
  id: "QuestionEntry",
});
