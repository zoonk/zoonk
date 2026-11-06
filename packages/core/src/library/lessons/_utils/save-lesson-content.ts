import "server-only";
import { type LessonMap } from "@zoonk/ai/tasks/lesson-writer/schema";
import { DbNull, type StepKind, type TransactionClient } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { type LibraryProvenance } from "../../_utils/library-rows";
import {
  PlanInputWriteConflictError,
  lockPlanSourceWrite,
  writePlanInputs,
} from "../../_utils/plan-input-write";
import { resolveReviewFlags } from "../../sources/content-review-flags";
import { STEP_CONTRACT_VERSION } from "../../steps/contract/step-contract";
import { type ScreenMathItem } from "../../steps/written-screens";
import { CURRENT_STEPS, lockCurrentLessonVersion, startLessonVersion } from "../lesson-versions";
import { getLessonScreenSkillId, isNotebookQuestionStep } from "./lesson-screen-skill";
import {
  dropUnaskedQuestions,
  parseScreenQuestion,
  saveQuestionItems,
  toScreenQuestion,
} from "./screen-question-item";
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
    staged = false,
  }: { language: string; lessonId: string; screens: LessonScreenToSave[]; staged?: boolean },
): Promise<number> {
  const itemIds = staged
    ? []
    : await saveQuestionItems(tx, {
        language,
        lessonId,
        screens: screens.map((screen) => ({
          provenance: screen.provenance,
          question: toScreenQuestion(screen.mathItem),
          skillId: screen.skillId,
        })),
      });

  const version = await startLessonVersion(tx, lessonId, { staged });

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
      staged,
      stagedItem: staged ? (toScreenQuestion(screen.mathItem) ?? undefined) : undefined,
      version,
    })),
  });

  await dropUnaskedQuestions(tx, lessonId);
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

/**
 * Saves the screens under the run's claim, which stays running until the run reports the lesson
 * ready (`completeLessonContent`). Returns null when the claim was lost; otherwise the version.
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
  summary: LessonMap;
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
      data: { heldBackDrafts: [], summary },
      where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
    });

    if (claimed.count === 0) {
      throw new LessonPublicationLostError();
    }

    return writeScreens(tx, { language, lessonId, screens: prepared });
  });
}

/**
 * Stages the version that replaces `replaces`, which learners keep getting until
 * `publishStagedLessonVersion`. Returns null if `replaces` is no longer current.
 */
export async function stageLessonVersion({
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
  summary: LessonMap;
}): Promise<number | null> {
  return publishVersion(lessonId, async (tx) => {
    const existing = await tx.step.findFirst({
      select: { version: true },
      where: { lesson: { contentStatus: "completed" }, lessonId, ...CURRENT_STEPS },
    });

    if (existing?.version !== replaces) {
      return null;
    }

    const prepared = await lockPreparedScreens(tx, { lessonId, screens });

    const current = await lockCurrentLessonVersion(tx, lessonId);

    if (current !== replaces) {
      throw new LessonPublicationLostError();
    }

    await tx.lesson.update({ data: { stagedSummary: summary }, where: { id: lessonId } });
    return writeScreens(tx, { language, lessonId, screens: prepared, staged: true });
  });
}

/** Returns null when `version` is no longer staged, such as when a newer one replaced it. */
export async function publishStagedLessonVersion({
  lessonId,
  version,
}: {
  lessonId: string;
  version: number;
}): Promise<number | null> {
  const staged = { lessonId, retiredAt: null, staged: true, version };

  return publishVersion(lessonId, async (tx) => {
    const questionSkills = await tx.step.findMany({
      select: { skillId: true },
      where: { ...staged, stagedItem: { not: DbNull } },
    });

    await lockPlanSourceWrite(tx, {
      lessonIds: [lessonId],
      skillIds: questionSkills.flatMap((step) => step.skillId ?? []),
    });

    await lockCurrentLessonVersion(tx, lessonId);

    const lesson = await tx.lesson.findUniqueOrThrow({
      select: {
        language: true,
        stagedSummary: true,
        steps: {
          select: {
            generatedAt: true,
            id: true,
            model: true,
            promptVersion: true,
            runId: true,
            skillId: true,
            stagedItem: true,
          },
          where: staged,
        },
      },
      where: { id: lessonId },
    });

    if (lesson.steps.length === 0) {
      return null;
    }

    const itemIds = await saveQuestionItems(tx, {
      language: lesson.language,
      lessonId,
      screens: lesson.steps.map((step) => ({
        provenance: step,
        question: parseScreenQuestion(step.stagedItem),
        skillId: step.skillId,
      })),
    });

    await tx.step.updateMany({
      data: { retiredAt: new Date() },
      where: { lessonId, ...CURRENT_STEPS },
    });

    await Promise.all(
      lesson.steps.flatMap((step, index) => {
        const itemId = itemIds[index];
        return itemId ? [tx.step.update({ data: { itemId }, where: { id: step.id } })] : [];
      }),
    );

    await tx.step.updateMany({ data: { staged: false, stagedItem: DbNull }, where: staged });
    await dropUnaskedQuestions(tx, lessonId);

    await tx.lesson.update({
      data: { stagedSummary: DbNull, summary: lesson.stagedSummary ?? DbNull },
      where: { id: lessonId },
    });

    return version;
  });
}
