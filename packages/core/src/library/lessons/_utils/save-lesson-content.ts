import "server-only";
import { type StepKind, type TransactionClient, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { toStoredItem } from "../../items/item-content";
import { resolveReviewFlags } from "../../sources/content-review-flags";
import { STEP_CONTRACT_VERSION } from "../../steps/contract/step-contract";
import { type ScreenMathItem } from "../../steps/written-screens";
import { toStepData } from "./step-data";

/** One checked screen, ready to store. */
export type LessonScreenToSave = {
  /** The page of the learner's material the screen teaches from, for lessons built from it. */
  citation?: { page: number | null; sourceId: string } | null;
  kind: StepKind;
  content: object;
  /** Stored as a numeric item for the screen's skill, so reviews can use new numbers. */
  mathItem: ScreenMathItem | null;
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
 * Publishes a checked lesson in one transaction: the summary card, every
 * screen in order (replacing anything an earlier attempt of the same run
 * left), the math items behind calculation checks, and the content claim
 * marked completed (drafts held back before it are cleared, so a later rewrite
 * gets every draft again). It only writes while this run holds the claim, so a run
 * that lost it changes nothing and gets `false`.
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
}): Promise<boolean> {
  const saved = await prisma.$transaction(async (tx) => {
    const claimed = await tx.lesson.updateMany({
      data: {
        contentStatus: "completed",
        heldBackDrafts: [],
        summary: { ideas: summary.map((text) => ({ text })) },
      },
      where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
    });

    if (claimed.count === 0) {
      return false;
    }

    await tx.step.deleteMany({ where: { lessonId } });

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
          position,
          provenance: screen.provenance,
          skillId: screen.skillId,
        }),
        lessonId,
        position,
        sourceId: screen.citation?.sourceId ?? null,
        sourcePage: screen.citation?.page ?? null,
      })),
    });

    // This version was written from the sources as they are now, so earlier change flags are done.
    await resolveReviewFlags({ target: { lessonId }, tx, writtenAt: new Date() });

    return true;
  });

  if (saved) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return saved;
}
