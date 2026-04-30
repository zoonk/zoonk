import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type Chapter, prisma } from "@zoonk/db";

export async function getCourseChaptersStep(courseId: string): Promise<Chapter[]> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "getExistingChapters" });

  const chapters = await prisma.chapter.findMany({
    orderBy: { position: "asc" },
    where: { courseId },
  });

  await stream.status({ status: "completed", step: "getExistingChapters" });

  return chapters;
}
