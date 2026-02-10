import { addAlternativeTitles } from "@zoonk/core/alternative-titles/add";
import { streamError, streamStatus } from "../stream-status";
import { type CourseContext } from "../types";

export async function addAlternativeTitlesStep(input: {
  course: CourseContext;
  alternativeTitles: string[];
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "addAlternativeTitles" });

  const { error } = await addAlternativeTitles({
    courseId: input.course.courseId,
    language: input.course.language,
    titles: input.alternativeTitles,
  });

  if (error) {
    await streamError({ reason: "dbSaveFailed", step: "addAlternativeTitles" });
    throw error;
  }

  await streamStatus({ status: "completed", step: "addAlternativeTitles" });
}
