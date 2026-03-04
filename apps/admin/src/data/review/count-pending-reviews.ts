import "server-only";
import { REVIEW_TASK_TYPES, type ReviewTaskType } from "@/lib/review-utils";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";

async function countUnreviewed(taskType: ReviewTaskType): Promise<number> {
  const excludeIds = await reviewedEntityIds(taskType);

  switch (taskType) {
    case "courseSuggestions":
      return prisma.courseSuggestion.count({
        where: {
          NOT: { id: { in: excludeIds.map(Number) } },
          generationStatus: "completed",
        },
      });

    case "stepVisual":
      return prisma.step.count({
        where: {
          NOT: { id: { in: excludeIds } },
          activity: { organization: { slug: AI_ORG_SLUG } },
          visualKind: { not: null },
        },
      });

    case "stepVisualImage":
      return prisma.step.count({
        where: {
          NOT: { id: { in: excludeIds } },
          activity: { organization: { slug: AI_ORG_SLUG } },
          visualKind: "image",
        },
      });

    case "wordAudio":
      return prisma.word.count({
        where: {
          NOT: { id: { in: excludeIds } },
          audioUrl: { not: null },
          organization: { slug: AI_ORG_SLUG },
        },
      });

    default:
      return 0;
  }
}

async function reviewedEntityIds(taskType: ReviewTaskType): Promise<bigint[]> {
  const reviews = await prisma.aiContentReview.findMany({
    select: { entityId: true },
    where: { taskType },
  });

  return reviews.map((review) => review.entityId);
}

function emptyCountRecord(): Record<ReviewTaskType, number> {
  return {
    courseSuggestions: 0,
    stepVisual: 0,
    stepVisualImage: 0,
    wordAudio: 0,
  };
}

export async function countPendingReviews(): Promise<Record<ReviewTaskType, number>> {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return emptyCountRecord();
  }

  const counts = await Promise.all(
    REVIEW_TASK_TYPES.map(async (taskType) => {
      const count = await countUnreviewed(taskType);
      return [taskType, count] as const;
    }),
  );

  return { ...emptyCountRecord(), ...Object.fromEntries(counts) };
}
