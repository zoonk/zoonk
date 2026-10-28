import { numericEntrySchema, optionSelectSchema } from "@zoonk/ai/tasks/v2/items/schemas";
import { lessonVisualSchema } from "@zoonk/ai/tasks/v2/visuals/schema";
import { itemImageSchema } from "@zoonk/core/library/items/image";
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

export const questionImageSchema = itemImageSchema.nullable();

export const questionVisualSchema = lessonVisualSchema
  .meta({
    description:
      "A bar or line chart (categories with up to three series of values) or a timeline of dated events, drawn from its data",
    id: "LessonVisual",
  })
  .nullable();

export const questionSelectSchema = optionSelectSchema.meta({
  description:
    'How many options to pick: 1 (answer with `selectedIndex`), an exact number ("choose two") or "all" ("select all that apply"), answered with `selectedIndexes`',
  id: "QuestionSelect",
});

export const questionUnitSchema = z
  .object({
    position: z
      .enum(["prefix", "suffix"])
      .meta({ description: "Where the unit goes: before the number for money (R$ 45)" }),
    symbol: z.string(),
  })
  .nullable()
  .meta({ description: "A math problem's unit, shown next to the answer field" });

export const questionEntrySchema = numericEntrySchema.meta({
  description:
    "How the answer is typed: `number` (any number, graded with a tolerance), `integer` (a whole number), `decimals` (rounded or cut to `places` decimal places) or `fraction` (a fraction such as 2/3, sent as its value, or a decimal with at least three places)",
  id: "QuestionEntry",
});
