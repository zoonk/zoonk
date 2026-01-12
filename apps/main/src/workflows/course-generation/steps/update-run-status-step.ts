import { updateCourseGenerationRun } from "@/data/course-generation-runs/update-course-generation-run";

import { streamStatus } from "../stream-status";
import type { CourseGenerationRunStatus } from "../types";

type Input = {
  runId: string;
  status: CourseGenerationRunStatus;
  courseId?: number;
};

export async function updateRunStatusStep(input: Input): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "updateRunStatus" });

  await updateCourseGenerationRun({
    courseId: input.courseId,
    runId: input.runId,
    status: input.status,
  });

  await streamStatus({ status: "completed", step: "updateRunStatus" });
}
