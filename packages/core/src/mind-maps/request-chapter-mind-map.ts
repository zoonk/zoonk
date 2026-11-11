import "server-only";
import { type Goal, prisma } from "@zoonk/db";
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
import { openUsageLedgerInWrite } from "../entitlements/bundle-claims";
import { type RefusedUsage } from "../entitlements/contract";
import { findGoalFor, findOwnedGoal } from "../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getLessonGenerationStates } from "../library/generation/lesson-generation-state";
import {
  type ChapterMapAdmission,
  admitChapterMap,
  lockMindMapRows,
  oweMindMapLaunches,
} from "./_utils/admit-chapter-map";
import { chapterMapClaims } from "./_utils/bulk-chapters";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { getMindMapStatus } from "./_utils/mind-map-view";

type OnItsWay = "drawing" | "writingLessons";

/** What an admitted map's run starts from: it writes `lessonIds` first, which the claim charged. */
export type MindMapLaunch = {
  analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
  forExam: boolean;
  lessonIds: string[];
};

/** An on-its-way result lacks generationId until the run records it. */
export type ChapterMindMapRequest =
  | { status: "ready" }
  | { generationId: string | null; status: OnItsWay }
  | { decision: RefusedUsage; status: "refused" }
  | { status: "notFound" }
  | { status: "plusRequired" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

async function findRunId(chapterId: string): Promise<string | null> {
  const row = await prisma.chapterMindMap.findUnique({
    select: { runId: true },
    where: { chapterId },
  });

  return row?.runId ?? null;
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

/** One chapter's admission, in its own learner write, which owes the run of a claimed map. */
async function admitMindMap({
  chapterId,
  launch,
  now,
  viewer,
}: {
  chapterId: string;
  launch: MindMapLaunch;
  now: Date;
  viewer: EntitlementViewer;
}): Promise<ChapterMapAdmission> {
  const { lessonIds } = launch;

  const admission = await writeLearnerChange<ChapterMapAdmission>(
    { userId: viewer.userId },
    async (transaction) => {
      const rows = await lockMindMapRows(transaction, { chapterIds: [chapterId], now });
      const row = rows.get(chapterId);

      if (!row) {
        throw new Error(`Chapter ${chapterId} has no mind map row to decide on.`);
      }

      const ledger = await openUsageLedgerInWrite({
        claims: chapterMapClaims({ chapterId, lessonIds }),
        now,
        transaction,
        viewer,
      });

      const decided = await admitChapterMap(transaction, { chapterId, ledger, lessonIds, row });

      if (decided.admission.status !== "claimed") {
        return unchanged(decided.admission);
      }

      await oweMindMapLaunches(transaction, {
        chapterIds: [chapterId],
        launch,
        userId: viewer.userId,
      });

      return decided.admission;
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

  const launch: MindMapLaunch = {
    analytics: { distinctId: goal.userId, goalId: goal.id, platform },
    forExam: goal.kind === "exam",
    lessonIds: await findLessonsToWrite(chapterId),
  };

  const admission = await admitMindMap({ chapterId, launch, now, viewer });

  if (admission.status === "ready" || admission.status === "refused") {
    return admission;
  }

  return {
    generationId: admission.status === "joined" ? await findRunId(chapterId) : null,
    status: launch.lessonIds.length > 0 ? "writingLessons" : "drawing",
  };
}

/**
 * A learner's tap only. The map and each lesson it writes first are claimed together or not at
 * all, and the claim owes the learner the map's run; retries are free per target and concurrent
 * learners join the same run.
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
