import { createStepStream } from "@/workflows/_shared/stream-status";
import { type CourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { withCurrentCourseRevision } from "@zoonk/core/workflows/internal/course-curriculum";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseContext } from "./initialize-course-step";

export async function updateCourseStep(input: {
  course: CourseContext;
  description: string;
  imageUrl: string | null;
  landingPage: CourseLandingPageContent | null;
}): Promise<void> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "updateCourse" });

  await withCurrentCourseRevision({
    context: {
      contentRevision: input.course.contentRevision,
      courseId: input.course.courseId,
      ...(input.course.generationRunId ? { workflowRunId: input.course.generationRunId } : {}),
    },
    operation: async (transaction) => {
      await transaction.course.update({
        data: {
          description: input.description,
          ...(input.imageUrl && { imageUrl: input.imageUrl }),
          ...(input.landingPage && { landingPage: input.landingPage }),
        },
        where: { id: input.course.courseId },
      });
    },
  });

  await stream.status({ status: "completed", step: "updateCourse" });
}
