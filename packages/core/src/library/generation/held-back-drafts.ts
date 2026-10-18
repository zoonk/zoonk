import { z } from "zod";

/**
 * The drafts a lesson gets before it's set aside: its writer's first, a fresh one by the same
 * writer told what held the first back, then one by a writer from another family.
 */
export const MAX_LESSON_DRAFTS = 3;

const heldBackDraftSchema = z.object({
  heldBackAt: z.string(),
  /** The model that wrote the draft, as the writer's provenance names it. */
  model: z.string(),
  /** What held it back, as the fix pass read it: `screen` is 0-based, or null for the whole lesson. */
  problems: z.array(z.object({ problem: z.string(), screen: z.int().nullable() })),
  runId: z.string(),
});

/** One draft the quality gate held back, as `Lesson.heldBackDrafts` stores it. */
export type HeldBackDraft = z.infer<typeof heldBackDraftSchema>;

const heldBackDraftsSchema = z.array(heldBackDraftSchema);

/** A lesson's held-back drafts, oldest first; anything unreadable counts as none. */
export function parseHeldBackDrafts(value: unknown): HeldBackDraft[] {
  return heldBackDraftsSchema.safeParse(value).data ?? [];
}
