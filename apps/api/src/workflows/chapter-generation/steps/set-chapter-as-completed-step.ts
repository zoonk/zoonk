import { updateChapterGenerationStatus } from "@/data/chapters/update-chapter-generation-status";
import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { streamStatus } from "../stream-status";
import { type ChapterContext } from "./get-chapter-step";

export async function setChapterAsCompletedStep(input: {
  context: ChapterContext;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setChapterAsCompleted" });

  const { error } = await updateChapterGenerationStatus({
    chapterId: input.context.id,
    generationRunId: input.workflowRunId,
    generationStatus: "completed",
  });

  if (error) {
    await streamStatus({ status: "error", step: "setChapterAsCompleted" });
    throw error;
  }

  await revalidateMainApp([cacheTagCourse({ courseSlug: input.context.course.slug })]);

  await streamStatus({ status: "completed", step: "setChapterAsCompleted" });
}
