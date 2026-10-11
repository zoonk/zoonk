import { lessonVisualSchema } from "@zoonk/ai/tasks/v2/visuals/schema";
import { type ItemSetKind } from "@zoonk/db";
import { z } from "zod";
import { listeningContentSchema } from "../listening/listening-content";

/**
 * A text several questions read (a passage, an article, a poem, a case), with where it comes from
 * when it's quoted ("Adapted from…") and a title when it has one.
 */
const textStimulusSchema = z.object({
  source: z.string().nullable(),
  text: z.string().min(1),
  title: z.string().nullable(),
});

/**
 * `ItemSet.content` for each kind: the stimulus every question of the set reads. A text or a case
 * is its words; a chart is the data the app draws, with the words around it, if any; a recording
 * is its script (`listeningContentSchema`), whose file is `ItemSet.mediaAssetId`.
 */
const ITEM_SET_CONTENT_SCHEMAS = {
  audio: listeningContentSchema,
  case: textStimulusSchema,
  chart: textStimulusSchema.extend({ text: z.string().nullable(), visual: lessonVisualSchema }),
  text: textStimulusSchema,
} as const satisfies Record<ItemSetKind, z.ZodType>;

type ItemSetContentByKind = {
  [KIND in ItemSetKind]: z.infer<(typeof ITEM_SET_CONTENT_SCHEMAS)[KIND]>;
};

/** A stored set's kind with its stimulus, narrowed together. */
export type ParsedItemSetContent = {
  [KIND in ItemSetKind]: { content: ItemSetContentByKind[KIND]; kind: KIND };
}[ItemSetKind];

/** The stimulus a set of the given kind stores. */
export type ItemSetContent<KIND extends ItemSetKind = ItemSetKind> = ItemSetContentByKind[KIND];

/**
 * Reads a set's stimulus for its kind. Content is written only after it passed its checks, so a
 * parse failure means corrupted data and throws.
 */
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
