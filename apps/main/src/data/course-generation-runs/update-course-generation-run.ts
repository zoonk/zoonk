import "server-only";

import { prisma } from "@zoonk/db";

import type { CourseGenerationRunStatus } from "@/workflows/course-generation/types";

export async function updateCourseGenerationRun(params: {
  runId: string;
  status: CourseGenerationRunStatus;
  courseId?: number;
}): Promise<void> {
  const { runId, status, courseId } = params;

  await prisma.courseGenerationRun.update({
    data: {
      status,
      ...(courseId !== undefined && { courseId }),
    },
    where: { runId },
  });
}
