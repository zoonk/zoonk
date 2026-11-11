import "server-only";
import { type LanguageLessonContent } from "@zoonk/ai/tasks/language/language-lesson";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { markPlanSourcesChanged } from "../../../learner/_utils/mark-learner-changed";
import { resolvePlanInputDependents } from "../../../plans/_utils/plan-input-dependencies";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { lockPlanSourceWrite, writePlanInputs } from "../../_utils/plan-input-write";
import { toStepData } from "../../lessons/_utils/step-data";
import { lockCurrentLessonVersion, startLessonVersion } from "../../lessons/lesson-versions";
import { STEP_CONTRACT_VERSION } from "../../steps/contract/step-contract";
import { type LanguageStepToSave } from "./language-lesson-steps";

/** Another run claimed the lesson, or another version replaced the one a fix was for. */
class LanguageLessonWriteLostError extends Error {
  override name = "LanguageLessonWriteLostError";
}

export type LanguageLessonRows = {
  content: LanguageLessonContent;
  lessonId: string;
  provenance: LibraryProvenance;
  sentenceIds: readonly string[];
  skillId: string | null;
  steps: readonly LanguageStepToSave[];
  wordIds: readonly string[];
};

function toLessonWords({ content, lessonId, provenance, wordIds }: LanguageLessonRows) {
  return content.words.flatMap((word, position) => {
    const wordId = wordIds[position];

    return wordId
      ? [
          {
            distractors: word.distractors,
            lessonId,
            note: word.note,
            position,
            translation: word.translation,
            wordId,
            ...toProvenanceData(provenance),
          },
        ]
      : [];
  });
}

function toLessonSentences({ content, lessonId, provenance, sentenceIds }: LanguageLessonRows) {
  return content.sentences.flatMap((sentence, position) => {
    const sentenceId = sentenceIds[position];

    return sentenceId
      ? [
          {
            distractors: sentence.distractors,
            explanation: sentence.explanation,
            lessonId,
            position,
            sentenceId,
            translation: sentence.translation,
            translationDistractors: sentence.translationDistractors,
            ...toProvenanceData(provenance),
          },
        ]
      : [];
  });
}

async function writeLessonVersion(
  tx: TransactionClient,
  rows: LanguageLessonRows,
): Promise<number> {
  const { lessonId, provenance, skillId, steps } = rows;

  const [version] = await Promise.all([
    startLessonVersion(tx, lessonId),
    tx.lessonWord.deleteMany({ where: { lessonId } }),
    tx.lessonSentence.deleteMany({ where: { lessonId } }),
  ]);

  await Promise.all([
    tx.lessonWord.createMany({ data: toLessonWords(rows) }),
    tx.lessonSentence.createMany({ data: toLessonSentences(rows) }),
    tx.step.createMany({
      data: steps.map((step, position) => ({
        ...toStepData({
          content: step.content,
          contractVersion: STEP_CONTRACT_VERSION,
          kind: step.kind,
          position,
          provenance,
          sentenceId: step.sentenceId,
          skillId,
          wordId: step.wordId,
        }),
        lessonId,
        position,
        version,
      })),
    }),
  ]);

  return version;
}

function toSummary(content: LanguageLessonContent) {
  return { ideas: content.summary.map((text) => ({ text })) };
}

/** Null when `workflowRunId` no longer holds the lesson's content claim. */
export async function saveLanguageLesson({
  workflowRunId,
  ...rows
}: LanguageLessonRows & { workflowRunId: string }): Promise<number | null> {
  const { content, lessonId } = rows;

  const { data: version, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      const current = await tx.lesson.findFirst({
        include: { skills: { select: { skillId: true } } },
        omit: { spec: true, summary: true },
        where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
      });

      if (!current) {
        return null;
      }

      const planIds = await resolvePlanInputDependents(tx, {
        lessonIds: [lessonId],
        skillIds: current.skills.map(({ skillId: linkedSkillId }) => linkedSkillId),
      });

      await markPlanSourcesChanged(tx, { planIds });

      const claimed = await tx.lesson.updateMany({
        data: {
          contentStatus: "completed",
          sentenceOrdersAttempts: 0,
          summary: toSummary(content),
        },
        where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
      });

      if (claimed.count === 0) {
        throw new LanguageLessonWriteLostError();
      }

      return writeLessonVersion(tx, rows);
    }),
  );

  if (error instanceof LanguageLessonWriteLostError) {
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

/** Null when `replaces` is no longer the version learners get. */
export async function republishLanguageLesson({
  replaces,
  ...rows
}: LanguageLessonRows & { replaces: number }): Promise<number | null> {
  const { content, lessonId } = rows;

  const { data: version, error } = await safeAsync(() =>
    writePlanInputs(async (tx) => {
      await lockPlanSourceWrite(tx, { lessonIds: [lessonId] });

      if ((await lockCurrentLessonVersion(tx, lessonId)) !== replaces) {
        throw new LanguageLessonWriteLostError();
      }

      await tx.lesson.update({
        data: { sentenceOrdersAttempts: 0, summary: toSummary(content) },
        where: { id: lessonId },
      });

      return writeLessonVersion(tx, rows);
    }),
  );

  if (error instanceof LanguageLessonWriteLostError) {
    return null;
  }

  if (error) {
    throw error;
  }

  revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  return version;
}
