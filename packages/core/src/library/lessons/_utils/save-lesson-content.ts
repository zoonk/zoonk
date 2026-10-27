import "server-only";
import { type StepKind, type TransactionClient } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import {
  PlanInputWriteConflictError,
  lockPlanSourceWrite,
  writePlanInputs,
} from "../../_utils/plan-input-write";
import { toStoredItem } from "../../items/item-content";
import { resolveReviewFlags } from "../../sources/content-review-flags";
import { STEP_CONTRACT_VERSION } from "../../steps/contract/step-contract";
import { type ScreenMathItem } from "../../steps/written-screens";
import { lockCurrentLessonVersion, startLessonVersion } from "../lesson-versions";
import { getLessonScreenSkillId, isNotebookQuestionStep } from "./lesson-screen-skill";
import { toStepData } from "./step-data";

/** A lost claim or version rolls admission back; persistence failures remain errors. */
class LessonPublicationLostError extends Error {
  override name = "LessonPublicationLostError";
}

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

function repairScreenSkill({
  lessonId,
  lessonSkillIds,
  screen,
}: {
  lessonId: string;
  lessonSkillIds: string[];
  screen: LessonScreenToSave;
}): LessonScreenToSave {
  if (!isNotebookQuestionStep(screen)) {
    return screen;
  }

  const skillId = getLessonScreenSkillId({ lessonSkillIds, skillId: screen.skillId });

  if (!skillId) {
    throw new Error(`Cannot publish question screens: lesson ${lessonId} has no linked skill.`);
  }

  return { ...screen, skillId };
}

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

  const stored = toStoredItem({
    ...screen.mathItem,
    difficulty: "medium",
    format: "numeric",
    otherSolutions: [],
  });

  const item = await tx.item.create({
    data: { ...stored, language, skillId: screen.skillId, ...toProvenanceData(screen.provenance) },
  });

  return item.id;
}

/**
 * The screens as they'll be stored: each skill as the library knows it now, and every question
 * screen on a skill of the lesson. Read before and again after the write's locks (see
 * `lockPreparedScreens`), so the math items it creates go on skills it has locked.
 */
async function prepareScreens(
  tx: TransactionClient,
  { lessonId, screens: uncheckedScreens }: { lessonId: string; screens: LessonScreenToSave[] },
): Promise<LessonScreenToSave[]> {
  const links = await tx.lessonSkill.findMany({
    orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
    where: { lessonId },
  });

  const lessonSkillIds = links.map((link) => link.skillId);

  const skills = await tx.skill.findMany({
    where: {
      id: {
        in: [
          ...new Set(
            uncheckedScreens.flatMap((screen) =>
              screen.skillId && isUuid(screen.skillId) ? [screen.skillId] : [],
            ),
          ),
        ],
      },
    },
  });

  // Skill merges flatten existing pointers to the survivor (`mergeSkillForAdmin`), including
  // the identity a writer loaded before the merge. Keep that identity when the lesson teaches it.
  const survivorIds = new Map(skills.map((skill) => [skill.id, skill.mergedIntoId ?? skill.id]));

  return uncheckedScreens.map((screen) =>
    repairScreenSkill({
      lessonId,
      lessonSkillIds,
      screen: {
        ...screen,
        skillId: screen.skillId ? (survivorIds.get(screen.skillId) ?? null) : null,
      },
    }),
  );
}

/**
 * Prepares the screens, then locks what plans read them through: the lesson and the skills of its
 * math items. A merge that moved the lesson's skills while the locks waited changes what the
 * screens point at, so the write starts over (see `writePlanInputs`) rather than storing screens
 * and items on a skill the lesson no longer teaches.
 */
async function lockPreparedScreens(
  tx: TransactionClient,
  { lessonId, screens }: { lessonId: string; screens: LessonScreenToSave[] },
): Promise<LessonScreenToSave[]> {
  const prepared = await prepareScreens(tx, { lessonId, screens });
  await lockPlanSourceWrite(tx, { lessonIds: [lessonId], skillIds: listItemSkillIds(prepared) });
  const locked = await prepareScreens(tx, { lessonId, screens });

  if (locked.some((screen, index) => screen.skillId !== prepared[index]?.skillId)) {
    throw new PlanInputWriteConflictError("The lesson's skills changed; try the write again.");
  }

  return locked;
}

/**
 * The skills of the math items the screens become: a plan counts them in its question bank, so a
 * plan that never read this lesson can still read them, through the skill.
 */
function listItemSkillIds(screens: readonly LessonScreenToSave[]): string[] {
  return [
    ...new Set(
      screens.flatMap((screen) => (screen.mathItem && screen.skillId ? [screen.skillId] : [])),
    ),
  ];
}

/**
 * Stores a lesson's prepared screens as its new version, in the caller's transaction: the version
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

/**
 * Runs a version's write: null when its claim or version was lost meanwhile (the write throws
 * `LessonPublicationLostError`, which rolls it back), else the version saved, whose lesson's
 * cached copy expires.
 */
async function publishVersion(
  lessonId: string,
  write: (tx: TransactionClient) => Promise<number | null>,
): Promise<number | null> {
  const { data: version, error } = await safeAsync(() => writePlanInputs(write));

  if (error instanceof LessonPublicationLostError) {
    return null;
  }

  if (error) {
    throw error;
  }

  if (version !== null) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

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
  return publishVersion(lessonId, async (tx) => {
    const lesson = await tx.lesson.findFirst({
      select: { id: true },
      where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
    });

    if (!lesson) {
      return null;
    }

    const prepared = await lockPreparedScreens(tx, { lessonId, screens });

    const claimed = await tx.lesson.updateMany({
      data: { contentStatus: "completed", heldBackDrafts: [], summary: toSummary(summary) },
      where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
    });

    if (claimed.count === 0) {
      throw new LessonPublicationLostError();
    }

    return writeScreens(tx, { language, lessonId, screens: prepared });
  });
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
  return publishVersion(lessonId, async (tx) => {
    const existing = await tx.step.findFirst({
      select: { version: true },
      where: { lesson: { contentStatus: "completed" }, lessonId, retiredAt: null },
    });

    if (existing?.version !== replaces) {
      return null;
    }

    const prepared = await lockPreparedScreens(tx, { lessonId, screens });

    /** The plain precondition read may change while admission waits; lock the lesson last. */
    const current = await lockCurrentLessonVersion(tx, lessonId);

    if (current !== replaces) {
      throw new LessonPublicationLostError();
    }

    await tx.lesson.update({ data: { summary: toSummary(summary) }, where: { id: lessonId } });
    return writeScreens(tx, { language, lessonId, screens: prepared });
  });
}
