import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseWorkflowStepName } from "@/workflows/config";
import { addAlternativeTitles } from "@zoonk/core/alternative-titles/add";
import { type CourseContext } from "./initialize-course-step";

export async function addAlternativeTitlesStep(input: {
  course: CourseContext;
  alternativeTitles: string[];
}): Promise<void> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "addAlternativeTitles" });

  const { error } = await addAlternativeTitles({
    courseId: input.course.courseId,
    language: input.course.language,
    titles: input.alternativeTitles,
  });

  if (error) {
    await stream.error({ reason: "dbSaveFailed", step: "addAlternativeTitles" });
    throw error;
  }

  await stream.status({ status: "completed", step: "addAlternativeTitles" });
}
