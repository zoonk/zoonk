import "server-only";
import { type StepKind, type TransactionClient, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { toStoredItem } from "../../items/item-content";
import { resolveReviewFlags } from "../../sources/content-review-flags";
import { STEP_CONTRACT_VERSION } from "../../steps/contract/step-contract";
import { type ScreenMathItem } from "../../steps/written-screens";
import { lockCurrentLessonVersion, startLessonVersion } from "../lesson-versions";
import { toStepData } from "./step-data";

/** One checked screen, ready to store. */
export type LessonScreenToSave = {
  /** The page of the learner's material the screen teaches from, for lessons built from it. */
  citation?: { page: number | null; sourceId: string } | null;
  kind: StepKind;
  content: object;
  /** Stored as a numeric item for the screen's skill, so reviews can use new numbers. */
  mathItem: ScreenMathItem | null;
  /** A picture the version it replaces already had for the same request, kept instead of drawn again. */
  mediaAssetId?: string | null;
  skillId: string | null;
  provenance: LibraryProvenance;
};

async function createMathItem({
  language,
  screen,
  tx,
}: {
  language: string;
  screen: LessonScreenToSave;
  tx: TransactionClient;
}): Promise<string | null> {
  if (!screen.mathItem || !screen.skillId) {
    return null;
  }

  const stored = toStoredItem({ ...screen.mathItem, difficulty: "medium", format: "numeric" });

  const item = await tx.item.create({
    data: { ...stored, language, skillId: screen.skillId, ...toProvenanceData(screen.provenance) },
  });

  return item.id;
}

/**
 * Stores a lesson's checked screens as its new version, in the caller's transaction: the version
 * they replace is retired (learners playing it finish it), then the math items behind calculation
 * checks and every screen in order. Flags on earlier versions' sources are resolved, since this
 * one was written from them as they are now.
 */
async function writeScreens(
  tx: TransactionClient,
  {
    language,
    lessonId,
    screens,
  }: { language: string; lessonId: string; screens: LessonScreenToSave[] },
): Promise<number> {
  const version = await startLessonVersion(tx, lessonId);

  const itemIds = await Promise.all(
    screens.map((screen) => createMathItem({ language, screen, tx })),
  );

  await tx.step.createMany({
    data: screens.map((screen, position) => ({
      ...toStepData({
        content: screen.content,
        contractVersion: STEP_CONTRACT_VERSION,
        itemId: itemIds[position] ?? null,
        kind: screen.kind,
        mediaAssetId: screen.mediaAssetId ?? null,
        position,
        provenance: screen.provenance,
        skillId: screen.skillId,
      }),
      lessonId,
      position,
      sourceId: screen.citation?.sourceId ?? null,
      sourcePage: screen.citation?.page ?? null,
      version,
    })),
  });

  await resolveReviewFlags({ target: { lessonId }, tx, writtenAt: new Date() });

  return version;
}

function toSummary(summary: string[]) {
  return { ideas: summary.map((text) => ({ text })) };
}

/**
 * Publishes a checked lesson in one transaction: the summary card, every screen in order (as a new
 * version when an earlier one exists), the math items behind calculation checks, and the content
 * claim marked completed (drafts held back before it are cleared, so a later rewrite gets every
 * draft again). It only writes while this run holds the claim, so a run that lost it changes
 * nothing and gets null; otherwise the version it saved.
 */
export async function saveLessonContent({
  language,
  lessonId,
  screens,
  summary,
  workflowRunId,
}: {
  language: string;
  lessonId: string;
  screens: LessonScreenToSave[];
  summary: string[];
  workflowRunId: string;
}): Promise<number | null> {
  const version = await prisma.$transaction(async (tx) => {
    const claimed = await tx.lesson.updateMany({
      data: { contentStatus: "completed", heldBackDrafts: [], summary: toSummary(summary) },
      where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
    });

    return claimed.count === 0 ? null : writeScreens(tx, { language, lessonId, screens });
  });

  if (version !== null) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return version;
}

/**
 * Publishes a fixed version of a lesson already published, after a check that ran on version
 * `replaces` found a problem. The lesson stays playable the whole time: the next open gets the new
 * version, and learners playing the one it replaces finish it. It writes only while `replaces` is
 * still the lesson's current version, so a version written meanwhile (a rewrite, another check's
 * fix) is never overwritten; null then, else the new version.
 */
export async function saveLessonVersion({
  language,
  lessonId,
  replaces,
  screens,
  summary,
}: {
  language: string;
  lessonId: string;
  replaces: number;
  screens: LessonScreenToSave[];
  summary: string[];
}): Promise<number | null> {
  const version = await prisma.$transaction(async (tx) => {
    const current = await lockCurrentLessonVersion(tx, lessonId);

    if (current !== replaces) {
      return null;
    }

    await tx.lesson.update({ data: { summary: toSummary(summary) }, where: { id: lessonId } });
    return writeScreens(tx, { language, lessonId, screens });
  });

  if (version !== null) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return version;
}
