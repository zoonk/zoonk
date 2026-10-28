import { z } from "zod";
import { type PlannedItem } from "../planner/plan-items";
import { type SelectedItemFacts } from "../planner/selected-item-facts";

const minutesSchema = z.number().nonnegative();

export const selectedItemFactsSchema = z
  .object({
    boss: z
      .object({
        kind: z.enum(["call", "recording", "text"]),
        minutes: minutesSchema,
        questions: z.int().nonnegative().nullable(),
        testedKeys: z.array(z.string()),
        testedSkillIds: z.array(z.string()),
        waiting: z.boolean(),
      })
      .optional(),
    days: z.array(z.tuple([z.iso.date(), minutesSchema, minutesSchema])).optional(),
    minutes: minutesSchema,
    parts: z.object({
      checkpoint: minutesSchema,
      practice: minutesSchema,
      unwritten: minutesSchema,
      written: minutesSchema,
    }),
    schemaVersion: z.literal(1),
    skillIds: z.array(z.string()),
    teachingEnd: z.iso.date().optional(),
  })
  .strict();

export type SavedItemFacts = z.infer<typeof selectedItemFactsSchema>;

export function readSelectedItemFacts(value: unknown): SavedItemFacts | null {
  const parsed = selectedItemFactsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function withSelectedItemFacts({
  facts,
  items,
}: {
  facts: ReadonlyMap<string, SelectedItemFacts>;
  items: readonly PlannedItem[];
}): (PlannedItem & { facts: SavedItemFacts })[] {
  return items.map((item) => ({
    ...item,
    facts: selectedItemFactsSchema.parse({ ...facts.get(item.key), schemaVersion: 1 }),
  }));
}
