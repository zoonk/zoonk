import { getChapterRevisionContext } from "@/workflows/_shared/course-generation-context";
import { createStepStream } from "@/workflows/_shared/stream-status";
import { withCurrentCourseRevision } from "@zoonk/core/workflows/internal/course-curriculum";
import { type ChapterStepName } from "@zoonk/core/workflows/steps";
import { type ChapterContext } from "./get-chapter-step";

export async function setChapterAsCompletedStep(input: {
  context: ChapterContext;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<ChapterStepName>();
  await stream.status({ status: "started", step: "setChapterAsCompleted" });

  const saved = await withCurrentCourseRevision({
    context: getChapterRevisionContext(input.context),
    operation: (transaction) =>
      transaction.chapter.updateMany({
        data: { generationRunId: input.workflowRunId, generationStatus: "completed" },
        where: { id: input.context.id },
      }),
  });

  if (saved.status === "superseded" || saved.value.count === 0) {
    return;
  }

  await stream.status({ status: "completed", step: "setChapterAsCompleted" });
}
