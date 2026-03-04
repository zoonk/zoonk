import "server-only";
import { type ReviewTaskType } from "@/lib/review-utils";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";

type ReviewQueueResult = {
  entityId: bigint | null;
  remaining: number;
};

const EMPTY_RESULT: ReviewQueueResult = { entityId: null, remaining: 0 };

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

  const where = {
    NOT: { id: { in: excludeIds.map(Number) } },
    suggestions: { some: {} },
  };

  const [next, remaining] = await Promise.all([
    prisma.searchPrompt.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
      where,
    }),
    prisma.searchPrompt.count({ where }),
  ]);

  return { entityId: next ? BigInt(next.id) : null, remaining };
}

async function getNextStepVisual(skipIds: bigint[]): Promise<ReviewQueueResult> {
  const reviewedIds = await reviewedEntityIds("stepVisual");
  const excludeIds = [...reviewedIds, ...skipIds];

  const where = {
    NOT: { id: { in: excludeIds } },
    activity: { organization: { slug: AI_ORG_SLUG } },
    visualKind: { not: null } as const,
  };

  const [next, remaining] = await Promise.all([
    prisma.step.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true }, where }),
    prisma.step.count({ where }),
  ]);

  return { entityId: next?.id ?? null, remaining };
}

async function getNextStepVisualImage(skipIds: bigint[]): Promise<ReviewQueueResult> {
  const reviewedIds = await reviewedEntityIds("stepVisualImage");
  const excludeIds = [...reviewedIds, ...skipIds];

  const where = {
    NOT: { id: { in: excludeIds } },
    activity: { organization: { slug: AI_ORG_SLUG } },
    visualKind: "image" as const,
  };

  const [next, remaining] = await Promise.all([
    prisma.step.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true }, where }),
    prisma.step.count({ where }),
  ]);

  return { entityId: next?.id ?? null, remaining };
}

async function getNextWordAudio(skipIds: bigint[]): Promise<ReviewQueueResult> {
  const reviewedIds = await reviewedEntityIds("wordAudio");
  const excludeIds = [...reviewedIds, ...skipIds];

  const where = {
    NOT: { id: { in: excludeIds } },
    audioUrl: { not: null },
    organization: { slug: AI_ORG_SLUG },
  };

  const [next, remaining] = await Promise.all([
    prisma.word.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true }, where }),
    prisma.word.count({ where }),
  ]);

  return { entityId: next?.id ?? null, remaining };
}

export async function getNextReviewItem(
  taskType: ReviewTaskType,
  skipIds: bigint[] = [],
): Promise<ReviewQueueResult> {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return EMPTY_RESULT;
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
      return EMPTY_RESULT;
  }
}
