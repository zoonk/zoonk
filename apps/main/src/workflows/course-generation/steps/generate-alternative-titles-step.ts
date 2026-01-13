import { generateAlternativeTitles } from "@zoonk/ai/alternative-titles/generate";
import { streamStatus } from "../stream-status";
import type { CourseContext } from "../types";

export async function generateAlternativeTitlesStep(
  course: CourseContext,
): Promise<string[]> {
  "use step";

  await streamStatus({ status: "started", step: "generateAlternativeTitles" });

  const { data } = await generateAlternativeTitles({
    language: course.language,
    title: course.courseTitle,
  });

  await streamStatus({
    status: "completed",
    step: "generateAlternativeTitles",
  });

  return data.alternatives;
}
