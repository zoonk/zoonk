import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { prisma } from "@zoonk/db";
import { cacheTagLesson } from "@zoonk/utils/cache";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type LessonContext } from "./get-lesson-step";

export async function setLessonAsCompletedStep(input: {
  context: LessonContext;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setLessonAsCompleted" });

  const { error } = await safeAsync(() =>
    prisma.lesson.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "completed",
      },
      select: { generationStatus: true, id: true },
      where: { id: input.context.id },
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "setLessonAsCompleted" });
    throw error;
  }

  await revalidateMainApp([cacheTagLesson({ lessonSlug: input.context.slug })]);

  await streamStatus({ status: "completed", step: "setLessonAsCompleted" });
}
