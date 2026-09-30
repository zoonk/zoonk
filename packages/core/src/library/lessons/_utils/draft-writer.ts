import "server-only";
import { getLessonRewriteModel } from "@zoonk/ai/tasks/v2/lesson-writer";
import { type HeldBackDraft, MAX_LESSON_DRAFTS } from "../../generation/held-back-drafts";

/**
 * Who writes a lesson's next draft and what it's told. A first draft comes from the scope's
 * writer (`model`, the task's default when unset). After a draft was held back, the same writer
 * drafts it afresh, told every problem that held earlier drafts back; the last allowed draft
 * comes from a writer of another family (`getLessonRewriteModel`), told the same.
 */
export function pickDraftWriter({
  heldBackDrafts,
  model,
}: {
  heldBackDrafts: readonly HeldBackDraft[];
  model: string | undefined;
}): { heldBackProblems: HeldBackDraft["problems"]; model: string | undefined } {
  const isLastDraft = heldBackDrafts.length >= MAX_LESSON_DRAFTS - 1;

  return {
    heldBackProblems: heldBackDrafts.flatMap((draft) => draft.problems),
    model: isLastDraft ? getLessonRewriteModel(heldBackDrafts.map((draft) => draft.model)) : model,
  };
}
