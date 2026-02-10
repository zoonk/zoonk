import { generateAlternativeTitles } from "@zoonk/ai/tasks/courses/alternative-titles";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";
import { type CourseContext } from "../types";

export async function generateAlternativeTitlesStep(course: CourseContext): Promise<string[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateAlternativeTitles" });

  const { data: result, error } = await safeAsync(() =>
    generateAlternativeTitles({
      language: course.language,
      title: course.courseTitle,
    }),
  );

  if (error) {
    await streamError({ reason: "aiGenerationFailed", step: "generateAlternativeTitles" });
    throw error;
  }

  await streamStatus({
    status: "completed",
    step: "generateAlternativeTitles",
  });

  return result.data.alternatives;
}
