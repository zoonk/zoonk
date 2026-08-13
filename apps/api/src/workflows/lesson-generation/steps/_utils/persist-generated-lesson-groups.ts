import { findGeneratedCompanionForSourceLesson } from "@zoonk/core/lessons/generated-companions";
import { getSplitLessonSlug } from "@zoonk/core/lessons/split-lessons";
import { type Lesson, type LessonCreateManyInput, type TransactionClient, prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { lockChapterLessonOrder } from "./lock-chapter-lesson-order";

const LESSON_PERSISTENCE_TRANSACTION_TIMEOUT_MS = 30_000;

export type GeneratedLessonGroup = { companionLesson: Lesson | null; sourceLesson: Lesson };

type PersistGeneratedLessonGroupsInput = {
  chapterId: string;
  groupCount: number;
  lessonId: string;
  persistGroups: (input: {
    groups: GeneratedLessonGroup[];
    transaction: TransactionClient;
  }) => Promise<void>;
  workflowRunId: string;
};

/**
 * Builds a continuation row that exists only inside the final persistence
 * transaction until its content is ready. Continuations copy the authored
 * description and number the title so learners can distinguish each part.
 */
function getContinuationLessonData({
  partNumber,
  position,
  rootLessonId,
  template,
  workflowRunId,
}: {
  partNumber: number;
  position: number;
  rootLessonId: string;
  template: Lesson;
  workflowRunId: string;
}): LessonCreateManyInput {
  const title = template.title ? `${template.title} ${partNumber}` : null;

  return {
    chapterId: template.chapterId,
    description: template.description,
    generationRunId: workflowRunId,
    generationStatus: "completed",
    imageUrl: null,
    isLocked: template.isLocked,
    isPublished: template.isPublished,
    kind: template.kind,
    language: template.language,
    normalizedTitle: title ? normalizeString(title) : null,
    organizationId: template.organizationId,
    position,
    slug: getSplitLessonSlug({ partNumber, rootLessonId, slug: template.slug }),
    title,
  };
}

/**
 * Creates the source and optional companion row for one continuation part. The
 * rows are inserted as completed because they cannot be observed before this
 * transaction commits, and any content failure rolls the entire transaction back.
 */
function getContinuationGroupData({
  companionLesson,
  groupIndex,
  insertionPosition,
  lessonsPerGroup,
  sourceLesson,
  workflowRunId,
}: {
  companionLesson: Lesson | null;
  groupIndex: number;
  insertionPosition: number;
  lessonsPerGroup: number;
  sourceLesson: Lesson;
  workflowRunId: string;
}): LessonCreateManyInput[] {
  const partNumber = groupIndex + 2;
  const sourcePosition = insertionPosition + groupIndex * lessonsPerGroup;

  return [
    getContinuationLessonData({
      partNumber,
      position: sourcePosition,
      rootLessonId: sourceLesson.id,
      template: sourceLesson,
      workflowRunId,
    }),
    ...(companionLesson
      ? [
          getContinuationLessonData({
            partNumber,
            position: sourcePosition + 1,
            rootLessonId: sourceLesson.id,
            template: companionLesson,
            workflowRunId,
          }),
        ]
      : []),
  ];
}

/**
 * Pairs created continuation sources and companions by their adjacent ordered
 * positions. Both lists came from one transaction and one deterministic insert.
 */
function getCreatedGroups({
  companionLesson,
  createdLessons,
  sourceLesson,
}: {
  companionLesson: Lesson | null;
  createdLessons: Lesson[];
  sourceLesson: Lesson;
}): GeneratedLessonGroup[] {
  const sources = createdLessons
    .filter((lesson) => lesson.kind === sourceLesson.kind)
    .toSorted((first, second) => first.position - second.position);

  const companions = companionLesson
    ? createdLessons
        .filter((lesson) => lesson.kind === companionLesson.kind)
        .toSorted((first, second) => first.position - second.position)
    : [];

  return sources.map((source, index) => ({
    companionLesson: companions[index] ?? null,
    sourceLesson: source,
  }));
}

/**
 * Inserts every additional lesson row needed by one generated result while the
 * chapter order is locked. The root pair remains the first group.
 */
async function createGeneratedLessonGroups({
  companionLesson,
  groupCount,
  sourceLesson,
  transaction,
  workflowRunId,
}: {
  companionLesson: Lesson | null;
  groupCount: number;
  sourceLesson: Lesson;
  transaction: TransactionClient;
  workflowRunId: string;
}): Promise<GeneratedLessonGroup[]> {
  if (groupCount === 1) {
    return [{ companionLesson, sourceLesson }];
  }

  const lessonsPerGroup = companionLesson ? 2 : 1;
  const additionalGroupCount = groupCount - 1;
  const insertionPosition = (companionLesson?.position ?? sourceLesson.position) + 1;

  await transaction.lesson.updateMany({
    data: { position: { increment: additionalGroupCount * lessonsPerGroup } },
    where: { chapterId: sourceLesson.chapterId, position: { gte: insertionPosition } },
  });

  const data = Array.from({ length: additionalGroupCount }).flatMap((_, groupIndex) =>
    getContinuationGroupData({
      companionLesson,
      groupIndex,
      insertionPosition,
      lessonsPerGroup,
      sourceLesson,
      workflowRunId,
    }),
  );

  const createdLessons = await transaction.lesson.createManyAndReturn({ data });

  return [
    { companionLesson, sourceLesson },
    ...getCreatedGroups({ companionLesson, createdLessons, sourceLesson }),
  ];
}

/**
 * Verifies that only the workflow that claimed the root lesson can persist its
 * generated result. A completed root from the same run means the transaction
 * committed and its lost response is being retried.
 */
function getPersistenceState({
  sourceLesson,
  workflowRunId,
}: {
  sourceLesson: Lesson;
  workflowRunId: string;
}): "persist" | "replayed" {
  if (
    sourceLesson.generationStatus === "completed" &&
    sourceLesson.generationRunId === workflowRunId
  ) {
    return "replayed";
  }

  if (
    sourceLesson.generationStatus !== "running" ||
    sourceLesson.generationRunId !== workflowRunId
  ) {
    throw new Error("Generated lesson persistence does not own the source lesson");
  }

  return "persist";
}

/** Finds the stable root ID in the chapter snapshot loaded under the order lock. */
function getRequiredSourceLesson({
  lessonId,
  lessons,
}: {
  lessonId: string;
  lessons: Lesson[];
}): Lesson {
  const sourceLesson = lessons.find((lesson) => lesson.id === lessonId);

  if (!sourceLesson) {
    throw new Error("Generated source lesson does not belong to the locked chapter");
  }

  return sourceLesson;
}

/**
 * Persists an entire split result as one atomic learner-visible change. The
 * transaction owns structural insertion, all source and companion content, and
 * completion; a failure therefore leaves neither partial lessons nor shifted order.
 */
export async function persistGeneratedLessonGroups({
  chapterId,
  groupCount,
  lessonId,
  persistGroups,
  workflowRunId,
}: PersistGeneratedLessonGroupsInput): Promise<void> {
  if (groupCount < 1) {
    throw new Error("Generated lesson persistence needs at least one group");
  }

  await prisma.$transaction(
    async (transaction) => {
      await lockChapterLessonOrder({ chapterId, transaction });

      const chapterLessons = await transaction.lesson.findMany({
        orderBy: { position: "asc" },
        where: { chapterId },
      });

      const sourceLesson = getRequiredSourceLesson({ lessonId, lessons: chapterLessons });

      if (getPersistenceState({ sourceLesson, workflowRunId }) === "replayed") {
        return;
      }

      const companionLesson = findGeneratedCompanionForSourceLesson({
        lessonId: sourceLesson.id,
        lessons: chapterLessons,
      });

      if (companionLesson?.generationStatus === "completed") {
        throw new Error("Completed companion cannot be replaced by source generation");
      }

      const groups = await createGeneratedLessonGroups({
        companionLesson,
        groupCount,
        sourceLesson,
        transaction,
        workflowRunId,
      });

      await persistGroups({ groups, transaction });

      const rootLessonIds = [sourceLesson.id, ...(companionLesson ? [companionLesson.id] : [])];

      await transaction.lesson.updateMany({
        data: { generationRunId: workflowRunId, generationStatus: "completed" },
        where: { id: { in: rootLessonIds } },
      });
    },
    {
      maxWait: LESSON_PERSISTENCE_TRANSACTION_TIMEOUT_MS,
      timeout: LESSON_PERSISTENCE_TRANSACTION_TIMEOUT_MS,
    },
  );
}
