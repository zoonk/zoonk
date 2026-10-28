import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getRequestPlatform } from "../analytics/request-platform";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { claimUsage } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { MIND_MAP_STALE_AFTER_MS, getMindMapStatus } from "./_utils/mind-map-view";

/** On start, the caller must start the claimed run; a generating result may lack generationId until the run records it. */
export type ChapterMindMapRequest =
  | { status: "ready" }
  | { generationId: string | null; status: "generating" }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      status: "start";
    }
  | { decision: RefusedUsage; status: "refused" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

async function findRunId(chapterId: string): Promise<string | null> {
  const row = await prisma.chapterMindMap.findUnique({
    select: { runId: true },
    where: { chapterId },
  });

  return row?.runId ?? null;
}

async function claimMindMap({ chapterId, now }: { chapterId: string; now: Date }) {
  const chapter = await prisma.chapter.findUniqueOrThrow({
    select: { language: true },
    where: { id: chapterId },
  });

  try {
    await prisma.chapterMindMap.create({
      data: { chapterId, language: chapter.language, status: "running" },
    });

    return true;
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }
  }

  const { count } = await prisma.chapterMindMap.updateMany({
    data: { runId: null, status: "running", updatedAt: now },
    where: {
      OR: [
        { status: { not: "running" } },
        { updatedAt: { lt: new Date(now.getTime() - MIND_MAP_STALE_AFTER_MS) } },
      ],
      chapterId,
    },
  });

  return count > 0;
}

/** Learner action only; retries are free per chapter and concurrent learners join the same generation. */
export async function requestChapterMindMap({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId: string;
}): Promise<ChapterMindMapRequest> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  if (!isUuid(chapterId)) {
    return { status: "notFound" };
  }

  const [facts] = await loadMindMapChapters({ chapterIds: [chapterId], goal: owned.goal });

  if (!facts) {
    return { status: "notFound" };
  }

  const now = new Date();

  const status = getMindMapStatus({ ...facts, now });

  if (status === "ready" || status === "unavailable") {
    return { status };
  }

  if (status === "generating") {
    return { generationId: await findRunId(chapterId), status: "generating" };
  }

  const decision = await claimUsage({ generated: true, kind: "mindMap", targetId: chapterId });

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  if (!(await claimMindMap({ chapterId, now }))) {
    return { generationId: await findRunId(chapterId), status: "generating" };
  }

  return {
    analytics: { distinctId: owned.userId, goalId, platform: await getRequestPlatform() },
    status: "start",
  };
}
