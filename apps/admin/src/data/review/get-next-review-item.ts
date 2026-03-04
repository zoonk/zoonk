import "server-only";
import { type ReviewTaskType } from "@/lib/review-utils";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { reviewedEntityIds } from "./count-pending-reviews";

type ReviewQueueResult = {
  entityId: bigint | null;
  remaining: number;
};

const EMPTY_RESULT: ReviewQueueResult = { entityId: null, remaining: 0 };

async function getNextCourseSuggestion(): Promise<ReviewQueueResult> {
  const excludeIds = await reviewedEntityIds("courseSuggestions");

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

async function getNextStepVisual(): Promise<ReviewQueueResult> {
  const excludeIds = await reviewedEntityIds("stepVisual");

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

async function getNextStepVisualImage(): Promise<ReviewQueueResult> {
  const excludeIds = await reviewedEntityIds("stepVisualImage");

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

async function getNextWordAudio(): Promise<ReviewQueueResult> {
  const excludeIds = await reviewedEntityIds("wordAudio");

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

export async function getNextReviewItem(taskType: ReviewTaskType): Promise<ReviewQueueResult> {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return EMPTY_RESULT;
  }

  switch (taskType) {
    case "courseSuggestions":
      return getNextCourseSuggestion();
    case "stepVisual":
      return getNextStepVisual();
    case "stepVisualImage":
      return getNextStepVisualImage();
    case "wordAudio":
      return getNextWordAudio();
    default:
      return EMPTY_RESULT;
  }
}
