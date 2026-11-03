import "server-only";
import { type CallReuse } from "@zoonk/ai/provider-options";
import { getLessonRewriteModel, getLessonWriterModel } from "@zoonk/ai/tasks/lesson-writer";
import { type HeldBackDraft, MAX_LESSON_DRAFTS } from "../../generation/held-back-drafts";

/** The same reuse the lesson's reviewer reads, so the writer and its reviewer agree on the lesson. */
export function pickDraftWriter({
  heldBackDrafts,
  reuse,
}: {
  heldBackDrafts: readonly HeldBackDraft[];
  reuse: CallReuse;
}): { heldBackProblems: HeldBackDraft["problems"]; model: string } {
  const isLastDraft = heldBackDrafts.length >= MAX_LESSON_DRAFTS - 1;

  return {
    heldBackProblems: heldBackDrafts.flatMap((draft) => draft.problems),
    model: isLastDraft
      ? getLessonRewriteModel(heldBackDrafts.map((draft) => draft.model))
      : getLessonWriterModel({ reuse }),
  };
}
