import "server-only";
import { type LanguageLessonContent } from "@zoonk/ai/tasks/v2/language/language-lesson";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { markPlansChanged } from "../../../learner/_utils/mark-learner-changed";
import { resolvePlanInputDependents } from "../../../plans/_utils/plan-input-dependencies";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { toStepData } from "../../lessons/_utils/step-data";
import { startLessonVersion } from "../../lessons/lesson-versions";
import { STEP_CONTRACT_VERSION } from "../../steps/contract/step-contract";
import { type LanguageStepToSave } from "./language-lesson-steps";

class LanguageLessonClaimLostError extends Error {
  override name = "LanguageLessonClaimLostError";
}

type SaveLanguageLessonInput = {
  content: LanguageLessonContent;
  lessonId: string;
  provenance: LibraryProvenance;
  sentenceIds: readonly string[];
  skillId: string | null;
  steps: readonly LanguageStepToSave[];
  wordIds: readonly string[];
  workflowRunId: string;
};

function toLessonWords({ content, lessonId, provenance, wordIds }: SaveLanguageLessonInput) {
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

function toLessonSentences({
  content,
  lessonId,
  provenance,
  sentenceIds,
}: SaveLanguageLessonInput) {
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

export async function saveLanguageLesson(input: SaveLanguageLessonInput): Promise<boolean> {
  const { content, lessonId, provenance, skillId, steps, workflowRunId } = input;

  const { data: saved, error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      const current = await tx.lesson.findFirst({
        include: { skills: { select: { skillId: true } } },
        omit: { spec: true, summary: true },
        where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
      });

      if (!current) {
        return false;
      }

      const planIds = await resolvePlanInputDependents(tx, {
        lessonIds: [lessonId],
        skillIds: current.skills.map(({ skillId: linkedSkillId }) => linkedSkillId),
      });

      await markPlansChanged(tx, { planIds });

      const claimed = await tx.lesson.updateMany({
        data: {
          contentStatus: "completed",
          summary: { ideas: content.summary.map((text) => ({ text })) },
        },
        where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
      });

      if (claimed.count === 0) {
        throw new LanguageLessonClaimLostError();
      }

      const [version] = await Promise.all([
        startLessonVersion(tx, lessonId),
        tx.lessonWord.deleteMany({ where: { lessonId } }),
        tx.lessonSentence.deleteMany({ where: { lessonId } }),
      ]);

      await Promise.all([
        tx.lessonWord.createMany({ data: toLessonWords(input) }),
        tx.lessonSentence.createMany({ data: toLessonSentences(input) }),
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

      return true;
    }),
  );

  if (error instanceof LanguageLessonClaimLostError) {
    return false;
  }

  if (error) {
    throw error;
  }

  if (saved) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return saved;
}
