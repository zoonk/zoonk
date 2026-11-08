import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getRequestPlatform } from "../analytics/request-platform";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../cache/tags";
import {
  type EntitlementViewer,
  getEntitlementViewer,
  getEntitlementViewerFor,
} from "../entitlements/_utils/entitlement-viewer";
import { claimUsagesInWrite } from "../entitlements/claim-usage";
import { type RefusedUsage, isRefusedUsage } from "../entitlements/contract";
import { findGoalFor, findOwnedGoal } from "../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getLessonGenerationStates } from "../library/generation/lesson-generation-state";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { type MindMapRow, getMindMapStatus } from "./_utils/mind-map-view";

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

type Admission =
  | { decision: RefusedUsage; status: "refused" }
  | { status: "claimed" }
  | { status: "joined" }
  | { status: "ready" }
  | { status: "unauthorized" };

async function findRunId(chapterId: string): Promise<string | null> {
  const row = await prisma.chapterMindMap.findUnique({
    select: { runId: true },
    where: { chapterId },
  });

  return row?.runId ?? null;
}

/** Waits for any request deciding on the map, then reads the map as it is now. */
async function lockMindMapRow(
  transaction: TransactionClient,
  { chapterId, now }: { chapterId: string; now: Date },
): Promise<MindMapRow> {
  await transaction.$executeRaw`
    INSERT INTO chapter_mind_maps (chapter_id, language, status, updated_at)
    VALUES (
      ${chapterId}::uuid,
      (SELECT language FROM library_chapters WHERE id = ${chapterId}::uuid),
      'pending',
      ${now}::timestamp
    )
    ON CONFLICT (chapter_id) DO NOTHING`;

  await transaction.$queryRaw`
    SELECT id FROM chapter_mind_maps WHERE chapter_id = ${chapterId}::uuid FOR UPDATE`;

  return transaction.chapterMindMap.findUniqueOrThrow({
    select: {
      imageHeight: true,
      imageUrl: true,
      imageWidth: true,
      status: true,
      structure: true,
      thumbnailUrl: true,
      updatedAt: true,
    },
    where: { chapterId },
  });
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

/**
 * Decides from the map as it is once this learner's turn comes: a map that's ready or being made by
 * then is returned or joined and claims nothing. Otherwise the map and each lesson it writes first
 * are claimed together with the map's row, or not at all.
 */
async function admitMindMap({
  chapterId,
  lessonIds,
  now,
  viewer,
}: {
  chapterId: string;
  lessonIds: readonly string[];
  now: Date;
  viewer: EntitlementViewer;
}): Promise<Admission> {
  const claims = [
    { generated: true, kind: "mindMap" as const, targetId: chapterId },
    ...lessonIds.map((lessonId) => ({
      generated: true,
      kind: "lessonStart" as const,
      targetId: lessonId,
    })),
  ];

  const admission = await writeLearnerChange<Admission>(
    { userId: viewer.userId },
    async (transaction) => {
      const row = await lockMindMapRow(transaction, { chapterId, now });

      const current = getMindMapStatus({
        canHaveMap: true,
        lessonsToWrite: lessonIds.length,
        now,
        owed: false,
        plusRequired: false,
        row,
      });

      if (current === "ready") {
        return unchanged({ status: "ready" as const });
      }

      if (current === "drawing" || current === "writingLessons") {
        return unchanged({ status: "joined" as const });
      }

      const decision = await claimUsagesInWrite({ claims, transaction, viewer });

      if (isRefusedUsage(decision)) {
        return unchanged({ decision, status: "refused" as const });
      }

      if (decision.status !== "allowed") {
        return unchanged({ status: "unauthorized" as const });
      }

      await transaction.chapterMindMap.update({
        data: { runId: null, status: "running", updatedAt: now },
        where: { chapterId },
      });

      return { status: "claimed" };
    },
  );

  if (admission.status === "claimed") {
    revalidateCacheTags([getAllowanceCacheTag(viewer.userId)]);
  }

  return admission;
}

async function requestFor({
  chapterId,
  goal,
  platform,
  readViewer,
}: {
  chapterId: string;
  goal: Goal;
  platform: AnalyticsPlatform | null;
  readViewer: () => Promise<EntitlementViewer | null>;
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

  const viewer = await readViewer();

  if (!viewer) {
    return { status: "unauthorized" };
  }

  const lessonIds = await findLessonsToWrite(chapterId);
  const admission = await admitMindMap({ chapterId, lessonIds, now, viewer });

  if (
    admission.status === "ready" ||
    admission.status === "refused" ||
    admission.status === "unauthorized"
  ) {
    return admission;
  }

  if (admission.status === "joined") {
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
    goal: owned.goal,
    platform: await getRequestPlatform(),
    readViewer: getEntitlementViewer,
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
    goal: owned.goal,
    platform: null,
    readViewer: () => getEntitlementViewerFor(userId),
  });
}
