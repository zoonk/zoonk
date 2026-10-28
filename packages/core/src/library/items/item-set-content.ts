import { lessonVisualSchema } from "@zoonk/ai/tasks/v2/visuals/schema";
import { type ItemSetKind } from "@zoonk/db";
import { z } from "zod";
import { listeningContentSchema } from "../listening/listening-content";

const textStimulusSchema = z.object({
  source: z.string().nullable(),
  text: z.string().min(1),
  title: z.string().nullable(),
});

const ITEM_SET_CONTENT_SCHEMAS = {
  audio: listeningContentSchema,
  case: textStimulusSchema,
  chart: textStimulusSchema.extend({ text: z.string().nullable(), visual: lessonVisualSchema }),
  text: textStimulusSchema,
} as const satisfies Record<ItemSetKind, z.ZodType>;

type ItemSetContentByKind = {
  [KIND in ItemSetKind]: z.infer<(typeof ITEM_SET_CONTENT_SCHEMAS)[KIND]>;
};

export type ParsedItemSetContent = {
  [KIND in ItemSetKind]: { content: ItemSetContentByKind[KIND]; kind: KIND };
}[ItemSetKind];

export type ItemSetContent<KIND extends ItemSetKind = ItemSetKind> = ItemSetContentByKind[KIND];

/** Throws on invalid stored content, which indicates corrupted data. */
export function parseItemSetContent({
  content,
  kind,
}: {
  content: unknown;
  kind: ItemSetKind;
}): ParsedItemSetContent {
  const parsed: unknown = ITEM_SET_CONTENT_SCHEMAS[kind].parse(content);

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The schema was picked by `kind`, so the parsed content belongs to that kind.
  return { content: parsed, kind } as ParsedItemSetContent;
}
