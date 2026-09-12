import { CURRENT_CURRICULUM_VERSION } from "@zoonk/core/courses/learning-plan-contract";
import { withCurrentCourseRevision } from "@zoonk/core/workflows/internal/course-curriculum";

export async function claimCurriculumGenerationStep(input: {
  courseId: string;
  contentRevision: number;
  workflowRunId: string;
}) {
  "use step";

  const result = await withCurrentCourseRevision({
    context: { contentRevision: input.contentRevision, courseId: input.courseId },
    operation: async (transaction) => {
      const course = await transaction.course.findUniqueOrThrow({
        include: { _count: { select: { chapters: true } } },
        where: { id: input.courseId },
      });

      if (course.curriculumVersion >= CURRENT_CURRICULUM_VERSION && course._count.chapters > 0) {
        return null;
      }

      if (
        course.generationStatus === "running" &&
        course.generationRunId &&
        course.generationRunId !== input.workflowRunId
      ) {
        return null;
      }

      return transaction.course.update({
        data: { generationRunId: input.workflowRunId, generationStatus: "running" },
        where: { id: course.id },
      });
    },
  });

  return result.status === "applied" ? result.value : null;
}
