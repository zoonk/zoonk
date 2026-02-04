import { generateCourseDescription } from "@zoonk/ai/tasks/courses/description";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type CourseContext } from "../types";

export async function generateDescriptionStep(course: CourseContext): Promise<string> {
  "use step";

  await streamStatus({ status: "started", step: "generateDescription" });

  const { data: result, error } = await safeAsync(() =>
    generateCourseDescription({
      language: course.language,
      title: course.courseTitle,
    }),
  );

  if (error) {
    await streamStatus({ status: "error", step: "generateDescription" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "generateDescription" });

  return result.data.description;
}
