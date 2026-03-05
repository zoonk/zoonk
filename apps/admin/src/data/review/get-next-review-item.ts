import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { type ReviewTaskType, getVisualKindFromTaskType } from "@/lib/review-utils";
import { type StepVisualKind, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { cache } from "react";
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

async function getNextStepVisualByKind(
  kind: StepVisualKind,
  taskType: ReviewTaskType,
): Promise<ReviewQueueResult> {
  const excludeIds = await reviewedEntityIds(taskType);

  const where = {
    NOT: { id: { in: excludeIds } },
    activity: { organization: { slug: AI_ORG_SLUG } },
    visualKind: kind,
  };

  const [next, remaining] = await Promise.all([
    prisma.step.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true }, where }),
    prisma.step.count({ where }),
  ]);

  return { entityId: next?.id ?? null, remaining };
}

async function getNextStepSelectImage(): Promise<ReviewQueueResult> {
  const excludeIds = await reviewedEntityIds("stepSelectImage");

  const where = {
    NOT: { id: { in: excludeIds } },
    activity: { organization: { slug: AI_ORG_SLUG } },
    kind: "selectImage" as const,
  };

  const [next, remaining] = await Promise.all([
    prisma.step.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true }, where }),
    prisma.step.count({ where }),
  ]);

  return { entityId: next?.id ?? null, remaining };
}

export const getNextReviewItem = cache(async function getNextReviewItem(
  taskType: ReviewTaskType,
): Promise<ReviewQueueResult> {
  if (!(await isAdmin())) {
    return EMPTY_RESULT;
  }

  const visualKind = getVisualKindFromTaskType(taskType);

  if (visualKind) {
    return getNextStepVisualByKind(visualKind, taskType);
  }

  if (taskType === "courseSuggestions") {
    return getNextCourseSuggestion();
  }

  if (taskType === "stepSelectImage") {
    return getNextStepSelectImage();
  }

  return EMPTY_RESULT;
});
