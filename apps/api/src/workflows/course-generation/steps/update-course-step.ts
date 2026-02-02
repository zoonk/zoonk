import { updateAICourse } from "@/data/courses/update-ai-course";
import { streamStatus } from "../stream-status";
import { type CourseContext } from "../types";

export async function updateCourseStep(input: {
  course: CourseContext;
  description: string;
  imageUrl: string | null;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "updateCourse" });

  const { error } = await updateAICourse({
    courseId: input.course.courseId,
    description: input.description,
    generationStatus: "completed",
    imageUrl: input.imageUrl ?? undefined,
  });

  if (error) {
    await streamStatus({ status: "error", step: "updateCourse" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "updateCourse" });
}
