import "server-only";
import {
  REVIEW_TASK_TYPES,
  type ReviewTaskType,
  getVisualKindFromTaskType,
} from "@/lib/review-utils";
import { getSession } from "@zoonk/core/users/session/get";
import { type StepVisualKind, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { cache } from "react";

export const reviewedEntityIds = cache(async function reviewedEntityIds(
  taskType: ReviewTaskType,
): Promise<bigint[]> {
  const reviews = await prisma.contentReview.findMany({
    select: { entityId: true },
    where: { taskType },
  });

  return reviews.map((review) => review.entityId);
});

function countPendingStepVisual(kind: StepVisualKind, excludeIds: bigint[]): Promise<number> {
  return prisma.step.count({
    where: {
      NOT: { id: { in: excludeIds } },
      activity: { organization: { slug: AI_ORG_SLUG } },
      visualKind: kind,
    },
  });
}

export const countPendingForTask = cache(async function countPendingForTask(
  taskType: ReviewTaskType,
): Promise<number> {
  const excludeIds = await reviewedEntityIds(taskType);
  const visualKind = getVisualKindFromTaskType(taskType);

  if (visualKind) {
    return countPendingStepVisual(visualKind, excludeIds);
  }

  if (taskType === "courseSuggestions") {
    return prisma.searchPrompt.count({
      where: {
        NOT: { id: { in: excludeIds.map(Number) } },
        suggestions: { some: {} },
      },
    });
  }

  if (taskType === "stepSelectImage") {
    return prisma.step.count({
      where: {
        NOT: { id: { in: excludeIds } },
        activity: { organization: { slug: AI_ORG_SLUG } },
        kind: "selectImage",
      },
    });
  }

  return 0;
});

function emptyCountRecord(): Record<ReviewTaskType, number> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- entries are generated from REVIEW_TASK_TYPES
  return Object.fromEntries(REVIEW_TASK_TYPES.map((t) => [t, 0])) as Record<ReviewTaskType, number>;
}

export const countPendingReviews = cache(async function countPendingReviews(): Promise<
  Record<ReviewTaskType, number>
> {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return emptyCountRecord();
  }

  const counts = await Promise.all(
    REVIEW_TASK_TYPES.map(async (taskType) => {
      const count = await countPendingForTask(taskType);
      return [taskType, count] as const;
    }),
  );

  return { ...emptyCountRecord(), ...Object.fromEntries(counts) };
});
