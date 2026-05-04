import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { prisma } from "@zoonk/db";
import { type CourseContext } from "./initialize-course-step";

export async function updateCourseStep(input: {
  course: CourseContext;
  description: string;
  imageUrl: string | null;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "updateCourse" });

  await prisma.course.update({
    data: { description: input.description, ...(input.imageUrl && { imageUrl: input.imageUrl }) },
    where: { id: input.course.courseId },
  });

  await stream.status({ status: "completed", step: "updateCourse" });
}
