import "server-only";
import { getLessonRewriteModel } from "@zoonk/ai/tasks/v2/lesson-writer";
import { type HeldBackDraft, MAX_LESSON_DRAFTS } from "../../generation/held-back-drafts";

export function pickDraftWriter({ heldBackDrafts }: { heldBackDrafts: readonly HeldBackDraft[] }): {
  heldBackProblems: HeldBackDraft["problems"];
  model: string | undefined;
} {
  const isLastDraft = heldBackDrafts.length >= MAX_LESSON_DRAFTS - 1;

  return {
    heldBackProblems: heldBackDrafts.flatMap((draft) => draft.problems),
    model: isLastDraft
      ? getLessonRewriteModel(heldBackDrafts.map((draft) => draft.model))
      : undefined,
  };
}
