import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type UsageLedger } from "../../entitlements/_utils/usage-ledger";
import { claimBundleInWrite } from "../../entitlements/bundle-claims";
import { type RefusedUsage, isRefusedUsage } from "../../entitlements/contract";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { type MindMapLaunch } from "../request-chapter-mind-map";
import { chapterMapClaims } from "./bulk-chapters";
import { type MindMapRow, getMindMapStatus } from "./mind-map-view";

export type ChapterMapAdmission =
  | { decision: RefusedUsage; status: "refused" }
  | { status: "claimed" }
  | { status: "joined" }
  | { status: "ready" };

/**
 * Waits for any request deciding on these maps, in chapter id order so writes that lock several
 * never wait on each other in a circle, then reads each map as it is now. A row it adds to lock a
 * chapter the write then refuses stays `pending`, which reads as no map.
 */
export async function lockMindMapRows(
  transaction: TransactionClient,
  { chapterIds, now }: { chapterIds: readonly string[]; now: Date },
): Promise<Map<string, MindMapRow>> {
  const ids = [...chapterIds].toSorted();

  await transaction.$executeRaw`
    INSERT INTO chapter_mind_maps (chapter_id, language, status, created_at, updated_at)
    SELECT c.id, c.language, 'pending', ${now}::timestamp, ${now}::timestamp
    FROM library_chapters c
    WHERE c.id = ANY(${ids}::uuid[])
    ORDER BY c.id
    ON CONFLICT (chapter_id) DO NOTHING`;

  await transaction.$queryRaw`
    SELECT id FROM chapter_mind_maps
    WHERE chapter_id = ANY(${ids}::uuid[])
    ORDER BY chapter_id
    FOR UPDATE`;

  const rows = await transaction.chapterMindMap.findMany({
    select: {
      chapterId: true,
      imageHeight: true,
      imageUrl: true,
      imageWidth: true,
      status: true,
      structure: true,
      thumbnailUrl: true,
      updatedAt: true,
    },
    where: { chapterId: { in: ids } },
  });

  return new Map(rows.map(({ chapterId, ...row }) => [chapterId, row]));
}

/**
 * Decides one chapter's map from its locked row, for a tap and for "Create all" alike: a map that's
 * ready or being made by then is returned or joined and claims nothing. Otherwise the map and each
 * lesson it writes first are claimed together, or not at all, and the row is marked running.
 */
export async function admitChapterMap(
  transaction: TransactionClient,
  {
    chapterId,
    ledger,
    lessonIds,
    row,
  }: { chapterId: string; ledger: UsageLedger; lessonIds: readonly string[]; row: MindMapRow },
): Promise<{ admission: ChapterMapAdmission; ledger: UsageLedger }> {
  const current = getMindMapStatus({
    canHaveMap: true,
    lessonsToWrite: lessonIds.length,
    now: ledger.now,
    owed: false,
    plusRequired: false,
    row,
  });

  if (current === "ready") {
    return { admission: { status: "ready" }, ledger };
  }

  if (current === "drawing" || current === "writingLessons") {
    return { admission: { status: "joined" }, ledger };
  }

  const claim = await claimBundleInWrite({
    claims: chapterMapClaims({ chapterId, lessonIds }),
    ledger,
    transaction,
  });

  if (isRefusedUsage(claim.decision)) {
    return { admission: { decision: claim.decision, status: "refused" }, ledger: claim.ledger };
  }

  await transaction.chapterMindMap.update({
    data: { runId: null, status: "running", updatedAt: ledger.now },
    where: { chapterId },
  });

  return { admission: { status: "claimed" }, ledger: claim.ledger };
}

/** In the admitting write, so a map is owed only if its claim commits, and its run starts from it. */
export function oweMindMapLaunches(
  transaction: TransactionClient,
  {
    chapterIds,
    launch,
    userId,
  }: { chapterIds: readonly string[]; launch: MindMapLaunch; userId: string },
) {
  const goalId = launch.analytics.goalId;

  return oweFollowUps({
    db: transaction,
    followUps: chapterIds.map((chapterId) => ({
      input: { chapterId, goalId, launch },
      kind: "makeChapterMindMap" as const,
    })),
    userId,
  });
}
