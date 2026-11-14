import { countLessonsForRegeneration } from "@/data/lessons/count-lessons-for-regeneration";
import { MAX_LESSONS_PER_REGENERATION } from "@zoonk/core/library/lessons/regeneration-filter";
import { RewriteLessonsDialog } from "./rewrite-lessons-dialog";

/**
 * Rewrites the lessons the list's model and prompt version filters pick. With neither picked there
 * is nothing to rewrite by, so the page has no button.
 */
export async function RewriteLessons({
  model,
  promptVersion,
}: {
  model?: string;
  promptVersion?: string;
}) {
  "use cache: private";

  if (!(model || promptVersion)) {
    return null;
  }

  const matching = await countLessonsForRegeneration({ model, promptVersion });

  return (
    <RewriteLessonsDialog
      batchSize={MAX_LESSONS_PER_REGENERATION}
      matching={matching}
      model={model}
      promptVersion={promptVersion}
    />
  );
}
