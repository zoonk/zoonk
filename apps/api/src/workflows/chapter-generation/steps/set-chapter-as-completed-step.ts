import { revalidateMainApp } from "@zoonk/core/cache/revalidate";
import { prisma } from "@zoonk/db";
import { cacheTagChapter } from "@zoonk/utils/cache";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type ChapterContext } from "./get-chapter-step";

export async function setChapterAsCompletedStep(input: {
  context: ChapterContext;
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "setChapterAsCompleted" });

  const { error } = await safeAsync(() =>
    prisma.chapter.update({
      data: {
        generationRunId: input.workflowRunId,
        generationStatus: "completed",
      },
      select: { generationStatus: true, id: true },
      where: { id: input.context.id },
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "setChapterAsCompleted" });
    throw error;
  }

  await revalidateMainApp([cacheTagChapter({ chapterSlug: input.context.slug })]);

  await streamStatus({ status: "completed", step: "setChapterAsCompleted" });
}
