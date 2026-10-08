import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getRequestPlatform } from "../analytics/request-platform";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { claimUsage } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { loadGoalMap } from "../view-models/_utils/goal-map";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { MIND_MAP_STALE_AFTER_MS, getMindMapStatus } from "./_utils/mind-map-view";

/**
 * `ready`: the chapter has its map. `generating`: a run is making it (`generationId` once the run
 * saved it). `start`: the caller starts the run that writes and draws it, already claimed for
 * them; its analytics name the learner, their goal and the client that asked. `refused`: the
 * learner's plan doesn't cover a new map now (its mind map limits, fair use or AI budget). `unavailable`: maps are for chapters the
 * learner finished whose lessons are written, outside a language's units.
 */
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

/**
 * Marks the map as being made, once: a new row, or one whose last run failed or stopped, taken
 * over. False when another request claimed it first, so this one joins that run instead.
 */
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

/**
 * Decides what asking for a chapter's mind map does, when the learner taps for it (never on a
 * screen view): a map that exists or is being made is returned as it is, free; otherwise making it
 * counts toward the learner's mind map limits (once per chapter, so asking again after a failed
 * run is free) and the caller starts the run that writes and draws it. The map is shared, so a
 * second learner's request joins the first one's run.
 */
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

  const map = await loadGoalMap({ goal: owned.goal });
  const [facts] = await loadMindMapChapters({ chapterIds: [chapterId], goal: owned.goal, map });

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
