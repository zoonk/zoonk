import { z } from "zod";

export const MAX_LESSON_DRAFTS = 3;

const heldBackDraftSchema = z.object({
  heldBackAt: z.string(),
  model: z.string(),
  problems: z.array(z.object({ problem: z.string(), screen: z.int().nullable() })),
  runId: z.string(),
});

export type HeldBackDraft = z.infer<typeof heldBackDraftSchema>;

const heldBackDraftsSchema = z.array(heldBackDraftSchema);

export function parseHeldBackDrafts(value: unknown): HeldBackDraft[] {
  return heldBackDraftsSchema.safeParse(value).data ?? [];
}
