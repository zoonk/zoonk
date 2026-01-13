import { generateCourseChapters } from "@zoonk/ai/course-chapters/generate";
import { streamStatus } from "../stream-status";
import type { CourseContext, GeneratedChapter } from "../types";

export async function generateChaptersStep(
  course: CourseContext,
): Promise<GeneratedChapter[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateChapters" });

  try {
    const { data } = await generateCourseChapters({
      courseTitle: course.courseTitle,
      language: course.language,
    });

    await streamStatus({ status: "completed", step: "generateChapters" });

    return data.chapters;
  } catch (error) {
    await streamStatus({ status: "error", step: "generateChapters" });
    throw error;
  }
}
