import "server-only";
import { type LessonMap } from "@zoonk/ai/tasks/lesson-writer/schema";
import { DbNull, type StepKind, type TransactionClient } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { type LibraryProvenance } from "../../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../../_utils/plan-input-write";
import {
  type SourceRead,
  reconcileLessonReviewFlags,
  saveStepSources,
} from "../../sources/content-review-flags";
import { STEP_CONTRACT_VERSION } from "../../steps/contract/step-contract";
import { type ScreenMathItem } from "../../steps/written-screens";
import {
  CURRENT_STEPS,
  lockCurrentLessonVersion,
  retireUnaskedQuestions,
  startLessonVersion,
} from "../lesson-versions";
import { lockPreparedScreens } from "./prepare-screens";
import { parseScreenQuestion, saveQuestionItems, toScreenQuestion } from "./screen-question-item";
import { toStepData } from "./step-data";

class LessonPublicationLostError extends Error {
  override name = "LessonPublicationLostError";
}

export type ScreenProvenance = LibraryProvenance & { sources: readonly SourceRead[] };

export type LessonScreenToSave = {
  citation?: { page: number | null; sourceId: string } | null;
  kind: StepKind;
  content: object;
  mathItem: ScreenMathItem | null;
  mediaAssetId?: string | null;
  skillId: string | null;
  provenance: ScreenProvenance;
};

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

  const steps = await tx.step.createManyAndReturn({
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
    select: { id: true, position: true },
  });

  await saveStepSources(
    tx,
    steps.map((step) => ({ id: step.id, sources: screens[step.position]?.provenance.sources })),
  );

  await retireUnaskedQuestions(tx, { lessonId });

  if (!staged) {
    await reconcileLessonReviewFlags(tx, lessonId);
  }

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
    await retireUnaskedQuestions(tx, { lessonId });
    await reconcileLessonReviewFlags(tx, lessonId);

    await tx.lesson.update({
      data: { stagedSummary: DbNull, summary: lesson.stagedSummary ?? DbNull },
      where: { id: lessonId },
    });

    return version;
  });
}
