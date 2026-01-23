import { updateChapterGenerationStatus } from "@/data/chapters/update-chapter-generation-status";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { revalidateTag } from "next/cache";
import { streamStatus } from "../stream-status";
import { type ChapterContext } from "./get-chapter-step";

type SetCompletedInput = {
  context: ChapterContext;
  workflowRunId: string;
};

export async function setChapterAsCompletedStep(input: SetCompletedInput): Promise<void> {
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

  revalidateTag(cacheTagCourse({ courseSlug: input.context.course.slug }), "max");

  await streamStatus({ status: "completed", step: "setChapterAsCompleted" });
}
