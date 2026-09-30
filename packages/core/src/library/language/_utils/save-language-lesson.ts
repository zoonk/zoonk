import "server-only";
import { type LanguageLessonContent } from "@zoonk/ai/tasks/v2/language/language-lesson";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../../cache/tags";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { toStepData } from "../../lessons/_utils/step-data";
import { STEP_CONTRACT_VERSION } from "../../steps/contract/step-contract";
import { type LanguageStepToSave } from "./language-lesson-steps";

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

/**
 * Publishes a language lesson in one transaction: the summary card, the
 * pair's links to its shared words and sentences (with translations,
 * explanations and wrong options), every screen in order, and the content
 * claim marked completed. Anything an earlier attempt left is replaced. It
 * only writes while this run holds the claim, so a run that lost it changes
 * nothing and gets `false`.
 */
export async function saveLanguageLesson(input: SaveLanguageLessonInput): Promise<boolean> {
  const { content, lessonId, provenance, skillId, steps, workflowRunId } = input;

  const saved = await prisma.$transaction(async (tx) => {
    const claimed = await tx.lesson.updateMany({
      data: {
        contentStatus: "completed",
        summary: { ideas: content.summary.map((text) => ({ text })) },
      },
      where: { contentRunId: workflowRunId, contentStatus: "running", id: lessonId },
    });

    if (claimed.count === 0) {
      return false;
    }

    await Promise.all([
      tx.step.deleteMany({ where: { lessonId } }),
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
        })),
      }),
    ]);

    return true;
  });

  if (saved) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return saved;
}
