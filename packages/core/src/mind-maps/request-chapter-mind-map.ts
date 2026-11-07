import "server-only";
import { type Goal, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getRequestPlatform } from "../analytics/request-platform";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import {
  type EntitlementViewer,
  getEntitlementViewerFor,
} from "../entitlements/_utils/entitlement-viewer";
import { claimUsages, claimUsagesFor } from "../entitlements/claim-usage";
import { type RefusedUsage, type UsageDecision } from "../entitlements/contract";
import { findGoalFor, findOwnedGoal } from "../learner/_utils/owned-goal";
import { getLessonGenerationStates } from "../library/generation/lesson-generation-state";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { MIND_MAP_STALE_AFTER_MS, getMindMapStatus } from "./_utils/mind-map-view";

type OnItsWay = "drawing" | "writingLessons";

/**
 * On start, the caller must start the claimed run, which writes `lessonIds` first; an on-its-way
 * result may lack generationId until the run records it.
 */
export type ChapterMindMapRequest =
  | { status: "ready" }
  | { generationId: string | null; status: OnItsWay }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      forExam: boolean;
      lessonIds: string[];
      status: "start";
    }
  | { decision: RefusedUsage; status: "refused" }
  | { status: "notFound" }
  | { status: "plusRequired" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

type UsageClaims = Parameters<typeof claimUsages>[0];

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

/** The chapter's lessons the run writes or joins first: every one not written and not set aside. */
async function findLessonsToWrite(chapterId: string): Promise<string[]> {
  const rows = await prisma.chapterLesson.findMany({
    select: { lessonId: true },
    where: { chapterId },
  });

  const states = await getLessonGenerationStates(rows.map((row) => row.lessonId));

  return [...states].flatMap(([lessonId, state]) =>
    state.status === "ready" || (state.status === "failed" && state.setAside) ? [] : lessonId,
  );
}

function toUsageClaims({
  chapterId,
  lessonIds,
}: {
  chapterId: string;
  lessonIds: readonly string[];
}): UsageClaims {
  return [
    { generated: true, kind: "mindMap", targetId: chapterId },
    ...lessonIds.map((lessonId) => ({
      generated: true,
      kind: "lessonStart" as const,
      targetId: lessonId,
    })),
  ];
}

async function requestFor({
  chapterId,
  claim,
  goal,
  platform,
  readViewer,
}: {
  chapterId: string;
  claim: (claims: UsageClaims) => Promise<UsageDecision>;
  goal: Goal;
  platform: AnalyticsPlatform | null;
  readViewer?: () => Promise<EntitlementViewer | null>;
}): Promise<ChapterMindMapRequest> {
  if (!isUuid(chapterId)) {
    return { status: "notFound" };
  }

  const [facts] = await loadMindMapChapters({ chapterIds: [chapterId], goal, readViewer });

  if (!facts) {
    return { status: "notFound" };
  }

  const now = new Date();
  // The owed follow-up asks through here too, so a map that's only owed still starts.
  const status = getMindMapStatus({ ...facts, now, owed: false });

  if (status === "ready" || status === "unavailable" || status === "plusRequired") {
    return { status };
  }

  if (status === "drawing" || status === "writingLessons") {
    return { generationId: await findRunId(chapterId), status };
  }

  const lessonIds = await findLessonsToWrite(chapterId);
  const decision = await claim(toUsageClaims({ chapterId, lessonIds }));

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  if (!(await claimMindMap({ chapterId, now }))) {
    return {
      generationId: await findRunId(chapterId),
      status: lessonIds.length > 0 ? "writingLessons" : "drawing",
    };
  }

  return {
    analytics: { distinctId: goal.userId, goalId: goal.id, platform },
    forExam: goal.kind === "exam",
    lessonIds,
    status: "start",
  };
}

/**
 * A learner's tap only. The map and each lesson it writes first are claimed together or not at
 * all; retries are free per target and concurrent learners join the same run.
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

  return requestFor({
    chapterId,
    claim: claimUsages,
    goal: owned.goal,
    platform: await getRequestPlatform(),
  });
}

/** Internal, for the map a learner's finish owes: `userId` must come from that write. */
export async function requestChapterMindMapFor({
  chapterId,
  goalId,
  userId,
}: {
  chapterId: string;
  goalId: string;
  userId: string;
}): Promise<ChapterMindMapRequest> {
  const owned = await findGoalFor({ goalId, userId });

  if (owned.status !== "ready") {
    return owned;
  }

  return requestFor({
    chapterId,
    claim: (claims) => claimUsagesFor({ claims, userId }),
    goal: owned.goal,
    platform: null,
    readViewer: () => getEntitlementViewerFor(userId),
  });
}
