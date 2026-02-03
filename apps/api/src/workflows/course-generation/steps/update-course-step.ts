import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type CourseContext } from "../types";

export async function updateCourseStep(input: {
  course: CourseContext;
  description: string;
  imageUrl: string | null;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "updateCourse" });

  const { error } = await safeAsync(() =>
    prisma.course.update({
      data: {
        description: input.description,
        generationStatus: "completed",
        ...(input.imageUrl && { imageUrl: input.imageUrl }),
      },
      where: { id: input.course.courseId },
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "updateCourse" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "updateCourse" });
}
