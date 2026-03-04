import "server-only";
import { type ReviewTaskType } from "@/lib/review-utils";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";

type ReviewQueueResult = {
  entityId: bigint | null;
  reviewed: number;
  total: number;
};

async function reviewedEntityIds(taskType: ReviewTaskType): Promise<bigint[]> {
  const reviews = await prisma.aiContentReview.findMany({
    select: { entityId: true },
    where: { taskType },
  });

  return reviews.map((review) => review.entityId);
}

async function getNextCourseSuggestion(skipIds: bigint[]): Promise<ReviewQueueResult> {
  const reviewedIds = await reviewedEntityIds("courseSuggestions");
  const excludeIds = [...reviewedIds, ...skipIds];

  const [next, total] = await Promise.all([
    prisma.courseSuggestion.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
      where: {
        NOT: { id: { in: excludeIds.map(Number) } },
        generationStatus: "completed",
      },
    }),
    prisma.courseSuggestion.count({
      where: { generationStatus: "completed" },
    }),
  ]);

  return {
    entityId: next ? BigInt(next.id) : null,
    reviewed: reviewedIds.length,
    total,
  };
}

async function getNextStepVisual(skipIds: bigint[]): Promise<ReviewQueueResult> {
  const reviewedIds = await reviewedEntityIds("stepVisual");
  const excludeIds = [...reviewedIds, ...skipIds];

  const baseWhere = {
    activity: { organization: { slug: AI_ORG_SLUG } },
    visualKind: { not: null } as const,
  };

  const [next, total] = await Promise.all([
    prisma.step.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
      where: { ...baseWhere, NOT: { id: { in: excludeIds } } },
    }),
    prisma.step.count({ where: baseWhere }),
  ]);

  return { entityId: next?.id ?? null, reviewed: reviewedIds.length, total };
}

async function getNextStepVisualImage(skipIds: bigint[]): Promise<ReviewQueueResult> {
  const reviewedIds = await reviewedEntityIds("stepVisualImage");
  const excludeIds = [...reviewedIds, ...skipIds];

  const baseWhere = {
    activity: { organization: { slug: AI_ORG_SLUG } },
    visualKind: "image" as const,
  };

  const [next, total] = await Promise.all([
    prisma.step.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
      where: { ...baseWhere, NOT: { id: { in: excludeIds } } },
    }),
    prisma.step.count({ where: baseWhere }),
  ]);

  return { entityId: next?.id ?? null, reviewed: reviewedIds.length, total };
}

async function getNextWordAudio(skipIds: bigint[]): Promise<ReviewQueueResult> {
  const reviewedIds = await reviewedEntityIds("wordAudio");
  const excludeIds = [...reviewedIds, ...skipIds];

  const baseWhere = {
    audioUrl: { not: null },
    organization: { slug: AI_ORG_SLUG },
  };

  const [next, total] = await Promise.all([
    prisma.word.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
      where: { ...baseWhere, NOT: { id: { in: excludeIds } } },
    }),
    prisma.word.count({ where: baseWhere }),
  ]);

  return { entityId: next?.id ?? null, reviewed: reviewedIds.length, total };
}

export async function getNextReviewItem(
  taskType: ReviewTaskType,
  skipIds: bigint[] = [],
): Promise<ReviewQueueResult> {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return { entityId: null, reviewed: 0, total: 0 };
  }

  switch (taskType) {
    case "courseSuggestions":
      return getNextCourseSuggestion(skipIds);
    case "stepVisual":
      return getNextStepVisual(skipIds);
    case "stepVisualImage":
      return getNextStepVisualImage(skipIds);
    case "wordAudio":
      return getNextWordAudio(skipIds);
    default:
      return { entityId: null, reviewed: 0, total: 0 };
  }
}
