import "server-only";
import { type CallReuse } from "@zoonk/ai/provider-options";
import { getLessonWriterModel } from "@zoonk/ai/tasks/lesson-writer";
import { type HeldBackDraft } from "../../generation/held-back-drafts";

export function pickDraftWriter({
  heldBackDrafts,
  reuse,
}: {
  heldBackDrafts: readonly HeldBackDraft[];
  reuse: CallReuse;
}): {
  heldBackProblems: (HeldBackDraft["problems"][number] & { source: "review" })[];
  model: string;
} {
  return {
    heldBackProblems: heldBackDrafts.flatMap((draft) =>
      draft.problems.map((problem) => ({ ...problem, source: "review" as const })),
    ),
    model: getLessonWriterModel({ reuse }),
  };
}
