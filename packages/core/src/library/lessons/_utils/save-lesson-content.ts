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

class LessonPublicationLostError extends Error {
  override name = "LessonPublicationLostError";
}

export type LessonScreenToSave = {
  citation?: { page: number | null; sourceId: string } | null;
  kind: StepKind;
  content: object;
  mathItem: ScreenMathItem | null;
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

function listItemSkillIds(screens: readonly LessonScreenToSave[]): string[] {
  return [
    ...new Set(
      screens.flatMap((screen) => (screen.mathItem && screen.skillId ? [screen.skillId] : [])),
    ),
  ];
}

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

/** Returns null when the generation claim was lost; otherwise returns the published version. */
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

/** Returns null if `replaces` is no longer current; never overwrites a newer version. */
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

    const current = await lockCurrentLessonVersion(tx, lessonId);

    if (current !== replaces) {
      throw new LessonPublicationLostError();
    }

    await tx.lesson.update({ data: { summary: toSummary(summary) }, where: { id: lessonId } });
    return writeScreens(tx, { language, lessonId, screens: prepared });
  });
}
