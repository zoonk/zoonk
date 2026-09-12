import { createStepStream } from "@/workflows/_shared/stream-status";
import { withCurrentCourseRevision } from "@zoonk/core/workflows/internal/course-curriculum";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { type CourseContext } from "./initialize-course-step";

export async function addCategoriesStep(input: {
  course: CourseContext;
  categories: string[];
}): Promise<void> {
  "use step";

  await using stream = createStepStream<CourseWorkflowStepName>();

  await stream.status({ status: "started", step: "addCategories" });

  const categories = input.categories.map((category) => ({
    category,
    courseId: input.course.courseId,
  }));

  await withCurrentCourseRevision({
    context: {
      contentRevision: input.course.contentRevision,
      courseId: input.course.courseId,
      ...(input.course.generationRunId ? { workflowRunId: input.course.generationRunId } : {}),
    },
    operation: async (transaction) => {
      await transaction.courseCategory.createMany({ data: categories, skipDuplicates: true });
    },
  });

  await stream.status({ status: "completed", step: "addCategories" });
}
