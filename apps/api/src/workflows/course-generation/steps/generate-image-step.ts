import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@/workflows/config";
import { generateCourseImage } from "@zoonk/core/courses/image";
import { type CourseContext } from "./initialize-course-step";

export async function generateImageStep(course: CourseContext): Promise<string | null> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "generateImage" });

  const { data: imageUrl, error } = await generateCourseImage({
    title: course.courseTitle,
  });

  if (error) {
    // Image generation failure is not critical, continue without image
    await stream.status({ status: "completed", step: "generateImage" });
    return null;
  }

  await stream.status({ status: "completed", step: "generateImage" });

  return imageUrl;
}
