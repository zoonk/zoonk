import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { REVIEW_TASK_TYPES, type ReviewTaskType } from "@/lib/review-utils";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { cache } from "react";

export const reviewedEntityIds = cache(async function reviewedEntityIds(
  taskType: ReviewTaskType,
): Promise<string[]> {
  const reviews = await prisma.contentReview.findMany({
    select: { entityId: true },
    where: { taskType },
  });

  return reviews.map((review) => review.entityId);
});

function hasStepImage(content: unknown): boolean {
  try {
    return Boolean(parseStepContent("static", content).image?.url);
  } catch {
    return false;
  }
}

async function countPendingStepImage(excludeIds: string[]): Promise<number> {
  const steps = await prisma.step.findMany({
    orderBy: { createdAt: "asc" },
    select: { content: true },
    where: {
      NOT: { id: { in: excludeIds } },
      activity: { organization: { slug: AI_ORG_SLUG } },
      kind: "static",
    },
  });

  return steps.filter((step) => hasStepImage(step.content)).length;
}

function countPendingWordAudio(excludeIds: string[]): Promise<number> {
  return prisma.word.count({
    where: {
      NOT: { id: { in: excludeIds } },
      audioUrl: { not: null },
      organization: { slug: AI_ORG_SLUG },
    },
  });
}

function countPendingSentenceAudio(excludeIds: string[]): Promise<number> {
  return prisma.sentence.count({
    where: {
      NOT: { id: { in: excludeIds } },
      audioUrl: { not: null },
      organization: { slug: AI_ORG_SLUG },
    },
  });
}

export const countPendingForTask = cache(async function countPendingForTask(
  taskType: ReviewTaskType,
): Promise<number> {
  const excludeIds = await reviewedEntityIds(taskType);

  if (taskType === "courseSuggestions") {
    return prisma.searchPrompt.count({
      where: {
        NOT: { id: { in: excludeIds } },
        suggestions: { some: {} },
      },
    });
  }

  if (taskType === "stepImage") {
    return countPendingStepImage(excludeIds);
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

  if (taskType === "wordAudio") {
    return countPendingWordAudio(excludeIds);
  }

  if (taskType === "sentenceAudio") {
    return countPendingSentenceAudio(excludeIds);
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
  if (!(await isAdmin())) {
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
