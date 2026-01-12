import { updateCourseGenerationRun } from "@/data/course-generation-runs/update-course-generation-run";

import type { CourseGenerationRunStatus } from "../types";

type Input = {
  runId: string;
  status: CourseGenerationRunStatus;
  courseId?: number;
};

export async function updateRunStatusStep(input: Input): Promise<void> {
  "use step";

  await updateCourseGenerationRun({
    courseId: input.courseId,
    runId: input.runId,
    status: input.status,
  });
}
