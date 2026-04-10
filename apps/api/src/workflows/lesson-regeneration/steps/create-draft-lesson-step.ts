import { randomUUID } from "node:crypto";
import { type LessonContext } from "@/workflows/lesson-generation/steps/get-lesson-step";
import { prisma } from "@zoonk/db";

const DRAFT_SLUG_SUFFIX_LENGTH = 8;

/**
 * This step exists so regeneration can build a full replacement lesson without
 * touching the current live lesson row. The draft stays unpublished under a
 * temporary slug, which keeps the existing URL and progress model stable until
 * promotion succeeds.
 */
export async function createDraftLessonStep(input: {
  lesson: LessonContext;
}): Promise<{ id: number }> {
  "use step";

  const draftLesson = await prisma.lesson.create({
    data: {
      chapterId: input.lesson.chapterId,
      concepts: input.lesson.concepts,
      description: input.lesson.description,
      generationRunId: null,
      generationStatus: "pending",
      generationVersion: null,
      isLocked: input.lesson.isLocked,
      isPublished: false,
      kind: input.lesson.kind,
      language: input.lesson.language,
      managementMode: input.lesson.managementMode,
      normalizedTitle: input.lesson.normalizedTitle,
      organizationId: input.lesson.organizationId,
      position: input.lesson.position,
      slug: `${input.lesson.slug}-regen-${randomUUID().slice(0, DRAFT_SLUG_SUFFIX_LENGTH)}`,
      title: input.lesson.title,
    },
    select: { id: true },
  });

  return draftLesson;
}
