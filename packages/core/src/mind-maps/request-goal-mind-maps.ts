import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { getRequestPlatform } from "../analytics/request-platform";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getAllowanceCacheTag } from "../cache/tags";
import {
  type EntitlementViewer,
  getEntitlementViewer,
} from "../entitlements/_utils/entitlement-viewer";
import { type UsageLedger } from "../entitlements/_utils/usage-ledger";
import { openUsageLedgerInWrite } from "../entitlements/bundle-claims";
import { type RefusedUsage } from "../entitlements/contract";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { loadChapterNumbering } from "../view-models/syllabus/_utils/chapter-numbers";
import {
  type ChapterMapAdmission,
  admitChapterMap,
  lockMindMapRows,
  oweMindMapLaunches,
} from "./_utils/admit-chapter-map";
import { chapterMapClaims, sortBulkChapters, toAllowanceStop } from "./_utils/bulk-chapters";
import { loadMindMapChapters } from "./_utils/load-mind-map-chapters";
import { type MindMapRow, getMindMapStatus } from "./_utils/mind-map-view";
import { sortBySyllabus } from "./_utils/syllabus-order";
import { type GoalMindMapGenerations } from "./mind-map-contract";
import { type MindMapLaunch } from "./request-chapter-mind-map";

export type GoalMindMapsRequest =
  | { generations: GoalMindMapGenerations; status: "ready" }
  | { status: "notFound" | "unauthorized" };

type Admitted = {
  accepted: string[];
  joined: string[];
  refused: string[];
  stop: RefusedUsage | null;
};

function record({
  admission,
  admitted,
  chapterId,
}: {
  admission: ChapterMapAdmission;
  admitted: Admitted;
  chapterId: string;
}): Admitted {
  if (admission.status === "claimed") {
    return { ...admitted, accepted: [...admitted.accepted, chapterId] };
  }

  if (admission.status === "refused") {
    return {
      ...admitted,
      refused: [...admitted.refused, chapterId],
      stop: admitted.stop ?? admission.decision,
    };
  }

  return { ...admitted, joined: [...admitted.joined, chapterId] };
}

/**
 * Admits each chapter's map in course order against one ledger, so a refusal leaves only that
 * chapter unstarted: it writes nothing, and the next chapter may still be free, as a retry is.
 */
async function admitInOrder(
  transaction: TransactionClient,
  {
    chapterIds,
    ledger,
    rows,
  }: { chapterIds: readonly string[]; ledger: UsageLedger; rows: ReadonlyMap<string, MindMapRow> },
): Promise<Admitted> {
  const start: { admitted: Admitted; ledger: UsageLedger } = {
    admitted: { accepted: [], joined: [], refused: [], stop: null },
    ledger,
  };

  const done = await chapterIds.reduce(async (previous, chapterId) => {
    const sofar = await previous;
    const row = rows.get(chapterId);

    if (!row) {
      throw new Error(`Chapter ${chapterId} has no mind map row to decide on.`);
    }

    const decided = await admitChapterMap(transaction, {
      chapterId,
      ledger: sofar.ledger,
      lessonIds: [],
      row,
    });

    return {
      admitted: record({ admission: decided.admission, admitted: sofar.admitted, chapterId }),
      ledger: decided.ledger,
    };
  }, Promise.resolve(start));

  return done.admitted;
}

async function admitAll({
  chapterIds,
  launch,
  now,
  viewer,
}: {
  chapterIds: readonly string[];
  launch: MindMapLaunch;
  now: Date;
  viewer: EntitlementViewer;
}): Promise<Admitted> {
  if (chapterIds.length === 0) {
    return { accepted: [], joined: [], refused: [], stop: null };
  }

  const admitted = await writeLearnerChange<Admitted>(
    { userId: viewer.userId },
    async (transaction) => {
      // Map rows before the usage lock, in the order a single chapter's request takes them.
      const rows = await lockMindMapRows(transaction, { chapterIds, now });

      const ledger = await openUsageLedgerInWrite({
        claims: chapterIds.flatMap((chapterId) => chapterMapClaims({ chapterId, lessonIds: [] })),
        now,
        transaction,
        viewer,
      });

      const result = await admitInOrder(transaction, { chapterIds, ledger, rows });

      if (result.accepted.length === 0) {
        return unchanged(result);
      }

      await oweMindMapLaunches(transaction, {
        chapterIds: result.accepted,
        launch,
        userId: viewer.userId,
      });

      return result;
    },
  );

  if (admitted.accepted.length > 0) {
    revalidateCacheTags([getAllowanceCacheTag(viewer.userId)]);
  }

  return admitted;
}

/**
 * "Create all chapter maps", a learner's tap only: starts the map of every chapter of the goal's
 * scope that has none ready or on its way, whose lessons are all written,
 * in course order, as far as the learner's allowance goes. It never writes lessons. Each started
 * map is owed to the learner's follow-ups with what its run starts from, in the same write.
 */
export async function requestGoalMindMaps({
  goalId,
}: {
  goalId: string;
}): Promise<GoalMindMapsRequest> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal } = owned;

  const [facts, numbering, viewer, platform] = await Promise.all([
    loadMindMapChapters({ goal }),
    loadChapterNumbering(goal),
    getEntitlementViewer(),
    getRequestPlatform(),
  ]);

  if (!viewer) {
    return { status: "unauthorized" };
  }

  const now = new Date();

  const chapters = sortBySyllabus({
    chapters: facts.filter((chapter) => chapter.canHaveMap),
    numbering,
  }).map(({ chapter }) => ({ ...chapter, status: getMindMapStatus({ ...chapter, now }) }));

  const sorted = sortBulkChapters(chapters);

  const admitted = await admitAll({
    chapterIds: sorted.eligible,
    launch: {
      analytics: { distinctId: goal.userId, goalId: goal.id, platform },
      forExam: goal.kind === "exam",
      lessonIds: [],
    },
    now,
    viewer,
  });

  return {
    generations: {
      accepted: admitted.accepted,
      joined: [...sorted.onItsWay, ...admitted.joined],
      stop: admitted.stop && toAllowanceStop({ decision: admitted.stop, now }),
      unstarted: [
        ...admitted.refused.map((chapterId) => ({ chapterId, reason: "allowance" as const })),
        ...sorted.needLessons.map((chapterId) => ({ chapterId, reason: "needsLessons" as const })),
      ],
    },
    status: "ready",
  };
}
