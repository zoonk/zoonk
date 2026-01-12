import "server-only";

import { prisma } from "@zoonk/db";

export async function createCourseGenerationRun(params: {
  runId: string;
  courseSuggestionId: number;
  title: string;
}): Promise<{ id: number }> {
  const { runId, courseSuggestionId, title } = params;

  return prisma.courseGenerationRun.create({
    data: {
      courseSuggestionId,
      runId,
      status: "running",
      title,
    },
    select: { id: true },
  });
}
