import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CurriculumChapter } from "@zoonk/ai/tasks/courses/curriculum";
import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import { replaceCourseCurriculum } from "@zoonk/core/workflows/internal/course-curriculum";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type Chapter } from "@zoonk/db";
import { type CourseContext } from "./initialize-course-step";

/** New and replacement outlines share complete validation and atomic persistence. */
export async function addChaptersStep(input: {
  course: CourseContext;
  chapters: CurriculumChapter[];
}): Promise<Chapter[]> {
  "use step";
  await using stream = createStepStream<CourseWorkflowStepName>();
  await stream.status({ status: "started", step: "addChapters" });

  const result = await replaceCourseCurriculum({
    chapters: input.chapters,
    context: {
      contentRevision: input.course.contentRevision,
      courseId: input.course.courseId,
      ...(input.course.generationRunId ? { workflowRunId: input.course.generationRunId } : {}),
    },
    curriculumVersion: CURRENT_CURRICULUM_VERSION,
  });

  if (result.status === "superseded") {
    return [];
  }

  await stream.status({ status: "completed", step: "addChapters" });
  return result.chapters;
}
