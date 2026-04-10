import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { prisma } from "@zoonk/db";
import { retireLiveLesson } from "./_utils/retire-live-lesson";

/**
 * This step exists so regeneration can finish cleanly when the new generation
 * decides the live lesson should not exist at all. In that case there is no
 * draft to promote, but we still need to remove or archive the old lesson with
 * the same learner-history rules used during normal promotion.
 */
export async function removeLiveLessonStep(input: { liveLesson: LessonContext }): Promise<void> {
  "use step";

  await prisma.$transaction(async (tx) => {
    await retireLiveLesson({ liveLesson: input.liveLesson, tx });
  });
}
