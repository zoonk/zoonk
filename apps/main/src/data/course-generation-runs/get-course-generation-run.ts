import "server-only";

import { prisma } from "@zoonk/db";

import type { CourseGenerationRunStatus } from "@/workflows/course-generation/types";

type CourseGenerationRunData = {
  id: number;
  runId: string;
  courseSuggestionId: number;
  courseId: number | null;
  title: string;
  status: CourseGenerationRunStatus;
  createdAt: Date;
  updatedAt: Date;
};

export async function getCourseGenerationRun(
  runId: string,
): Promise<CourseGenerationRunData | null> {
  const run = await prisma.courseGenerationRun.findUnique({
    where: { runId },
  });

  if (!run) {
    return null;
  }

  return {
    ...run,
    status: run.status as CourseGenerationRunStatus,
  };
}
