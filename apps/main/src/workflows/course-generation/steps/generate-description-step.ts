import { generateCourseDescription } from "@zoonk/ai/course-description/generate";
import { streamStatus } from "../stream-status";
import type { CourseContext } from "../types";

export async function generateDescriptionStep(
  course: CourseContext,
): Promise<string> {
  "use step";

  await streamStatus({ status: "started", step: "generateDescription" });

  const { data } = await generateCourseDescription({
    language: course.language,
    title: course.courseTitle,
  });

  await streamStatus({ status: "completed", step: "generateDescription" });

  return data.description;
}
