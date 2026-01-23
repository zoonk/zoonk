import { generateCourseImage } from "@zoonk/core/courses/image";
import { streamStatus } from "../stream-status";
import type { CourseContext } from "../types";

export async function generateImageStep(course: CourseContext): Promise<string | null> {
  "use step";

  await streamStatus({ status: "started", step: "generateImage" });

  const { data: imageUrl, error } = await generateCourseImage({
    title: course.courseTitle,
  });

  if (error) {
    // Image generation failure is not critical, continue without image
    await streamStatus({ status: "completed", step: "generateImage" });
    return null;
  }

  await streamStatus({ status: "completed", step: "generateImage" });

  return imageUrl;
}
