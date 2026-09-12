import {
  type CourseRevisionContext,
  withCurrentCourseRevision,
} from "@zoonk/core/workflows/internal/course-curriculum";

export async function finishCurriculumGenerationStep(input: {
  context: CourseRevisionContext;
  status: "completed" | "failed";
}) {
  "use step";

  return withCurrentCourseRevision({
    context: input.context,
    operation: async (transaction) => {
      await transaction.course.update({
        data: { generationStatus: input.status },
        where: { id: input.context.courseId },
      });

      await transaction.coursePrompt.updateMany({
        data: { generationStatus: input.status },
        where: { courseId: input.context.courseId },
      });
    },
  });
}
