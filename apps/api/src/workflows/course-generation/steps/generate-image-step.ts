import { createStepStream } from "@/workflows/_shared/stream-status";
import { generateCourseImage } from "@zoonk/core/courses/image";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseContext } from "./initialize-course-step";

export async function generateImageStep(course: CourseContext): Promise<string | null> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "generateImage" });

  const { data: imageUrl, error } = await generateCourseImage({
    title: course.courseTitle,
  });

  if (error) {
    throw error;
  }

  if (!imageUrl) {
    throw new Error("Course image generation returned no URL");
  }

  await stream.status({ status: "completed", step: "generateImage" });

  return imageUrl;
}
