import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type Chapter, getActiveChapterWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function getCourseChaptersStep(courseId: number): Promise<Chapter[]> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "getExistingChapters" });

  const { data: chapters, error } = await safeAsync(() =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: getActiveChapterWhere({
        chapterWhere: { courseId },
      }),
    }),
  );

  if (error || !chapters) {
    await stream.error({ reason: "dbFetchFailed", step: "getExistingChapters" });
    throw error ?? new Error("Failed to fetch existing chapters");
  }

  await stream.status({ status: "completed", step: "getExistingChapters" });

  return chapters;
}
