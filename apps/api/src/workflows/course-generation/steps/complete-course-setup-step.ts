import { prisma } from "@zoonk/db";
import { rejected } from "@zoonk/utils/settled";
import { streamError, streamStatus } from "../stream-status";

export async function completeCourseSetupStep(input: {
  courseSuggestionId: number;
  courseId: number;
}): Promise<void> {
  "use step";

  await streamStatus({ status: "started", step: "completeCourseSetup" });

  const results = await Promise.allSettled([
    prisma.course.update({
      data: { generationStatus: "completed" },
      where: { id: input.courseId },
    }),
    prisma.courseSuggestion.update({
      data: { generationStatus: "completed" },
      where: { id: input.courseSuggestionId },
    }),
  ]);

  if (rejected(results)) {
    await streamError({ reason: "dbSaveFailed", step: "completeCourseSetup" });
    throw new Error("DB save failed in completeCourseSetup");
  }

  await streamStatus({ status: "completed", step: "completeCourseSetup" });
}
