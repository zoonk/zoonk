import { createStepStream } from "@/workflows/_shared/stream-status";
import { addAlternativeTitles } from "@zoonk/core/alternative-titles/add";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
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
    throw error;
  }

  await stream.status({ status: "completed", step: "addAlternativeTitles" });
}
