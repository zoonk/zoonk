import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { type ReviewTaskType } from "@/lib/review-utils";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { cache } from "react";
import { reviewedEntityIds } from "./count-pending-reviews";

type ReviewQueueResult = { entityId: string | null; remaining: number };

const EMPTY_RESULT: ReviewQueueResult = { entityId: null, remaining: 0 };

/**
 * Step image review stores image eligibility inside the JSON step content, so
 * Prisma can narrow the cheap relational fields first and the caller can then
 * keep only static steps whose parsed content actually contains an image URL.
 */
function getStepImageReviewWhere({
  excludeIds,
  lessonSlug,
}: {
  excludeIds: string[];
  lessonSlug?: string;
}) {
  return {
    NOT: { id: { in: excludeIds } },
    kind: "static" as const,
    lesson: { organization: { slug: AI_ORG_SLUG }, ...(lessonSlug ? { slug: lessonSlug } : {}) },
  };
}

function hasStepImage(content: unknown): boolean {
  try {
    return Boolean(parseStepContent("static", content).image?.url);
  } catch {
    return false;
  }
}

async function getNextCourseSuggestion(): Promise<ReviewQueueResult> {
  const excludeIds = await reviewedEntityIds("courseSuggestions");

  const where = { NOT: { id: { in: excludeIds } }, suggestions: { some: {} } };

  const [next, remaining] = await Promise.all([
    prisma.searchPrompt.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true }, where }),
    prisma.searchPrompt.count({ where }),
  ]);

  return { entityId: next?.id ?? null, remaining };
}

async function getNextStepImage(lessonSlug?: string): Promise<ReviewQueueResult> {
  const excludeIds = await reviewedEntityIds("stepImage");
  const where = getStepImageReviewWhere({ excludeIds, lessonSlug });

  const steps = await prisma.step.findMany({
    orderBy: { createdAt: "asc" },
    select: { content: true, id: true },
    where,
  });

  const pending = steps.filter((step) => hasStepImage(step.content));
  return { entityId: pending[0]?.id ?? null, remaining: pending.length };
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

async function getNextSentenceAudio(): Promise<ReviewQueueResult> {
  const excludeIds = await reviewedEntityIds("sentenceAudio");

  const where = {
    NOT: { id: { in: excludeIds } },
    audioUrl: { not: null },
    organization: { slug: AI_ORG_SLUG },
  };

  const [next, remaining] = await Promise.all([
    prisma.sentence.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true }, where }),
    prisma.sentence.count({ where }),
  ]);

  return { entityId: next?.id ?? null, remaining };
}

async function getNextStepSelectImage(): Promise<ReviewQueueResult> {
  const excludeIds = await reviewedEntityIds("stepSelectImage");

  const where = {
    NOT: { id: { in: excludeIds } },
    kind: "selectImage" as const,
    lesson: { organization: { slug: AI_ORG_SLUG } },
  };

  const [next, remaining] = await Promise.all([
    prisma.step.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true }, where }),
    prisma.step.count({ where }),
  ]);

  return { entityId: next?.id ?? null, remaining };
}

export const getNextReviewItem = cache(
  async (taskType: ReviewTaskType, lessonSlug?: string): Promise<ReviewQueueResult> => {
    if (!(await isAdmin())) {
      return EMPTY_RESULT;
    }

    if (taskType === "courseSuggestions") {
      return getNextCourseSuggestion();
    }

    if (taskType === "stepImage") {
      return getNextStepImage(lessonSlug);
    }

    if (taskType === "stepSelectImage") {
      return getNextStepSelectImage();
    }

    if (taskType === "wordAudio") {
      return getNextWordAudio();
    }

    if (taskType === "sentenceAudio") {
      return getNextSentenceAudio();
    }

    return EMPTY_RESULT;
  },
);
