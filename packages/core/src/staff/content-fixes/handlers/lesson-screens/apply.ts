import { isDeepStrictEqual } from "node:util";
import { DbNull, type TransactionClient } from "@zoonk/db";
import { toStoredItem } from "../../../../library/items/item-content";
import {
  retireUnaskedQuestions,
  startLessonVersion,
} from "../../../../library/lessons/lesson-versions";
import { type FixContext } from "../fix-handler";
import { screenItemIds } from "./references";
import { type StoredScreens } from "./schema";

export async function applyLessonScreens(
  tx: TransactionClient,
  change: StoredScreens,
  context: FixContext,
) {
  const { id: lessonId, before, after } = change;
  const provenance = { model: "staff", promptVersion: "setScreens", runId: context.fixId };
  const version = await startLessonVersion(tx, lessonId);

  if (version !== after.version) {
    throw new Error("Lesson screen version changed during approval");
  }

  if (change.newItems.length > 0) {
    const { language } = await tx.lesson.findUniqueOrThrow({
      select: { language: true },
      where: { id: lessonId },
    });

    await tx.item.createMany({
      data: change.newItems.map(({ id, question, skillId }) => ({
        ...toStoredItem(question),
        ...provenance,
        id,
        language,
        skillId,
      })),
    });
  }

  const restored = after.screens.flatMap(({ itemId }) =>
    itemId && !before.screens.some((row) => row.itemId === itemId) ? [itemId] : [],
  );

  if (restored.length > 0) {
    await tx.item.updateMany({
      data: { retiredAt: null },
      where: { id: { in: restored }, retiredAt: { not: null } },
    });
  }

  if (!isDeepStrictEqual(before.summary, after.summary)) {
    await tx.lesson.update({ data: { summary: after.summary ?? DbNull }, where: { id: lessonId } });
  }

  if (!isDeepStrictEqual(before.words, after.words)) {
    await tx.lessonWord.deleteMany({
      where: { lessonId, wordId: { notIn: after.words.map(({ id }) => id) } },
    });

    await Promise.all(
      after.words.map((row, position) => {
        if (isDeepStrictEqual(row, before.words[position])) {
          return Promise.resolve();
        }

        const data = {
          distractors: row.distractors,
          note: row.note,
          position,
          translation: row.translation,
          ...provenance,
        };

        return tx.lessonWord.upsert({
          create: { lessonId, wordId: row.id, ...data },
          update: data,
          where: { lessonId_wordId: { lessonId, wordId: row.id } },
        });
      }),
    );
  }

  if (!isDeepStrictEqual(before.sentences, after.sentences)) {
    await tx.lessonSentence.deleteMany({
      where: { lessonId, sentenceId: { notIn: after.sentences.map(({ id }) => id) } },
    });

    await Promise.all(
      after.sentences.map((row, position) => {
        if (isDeepStrictEqual(row, before.sentences[position])) {
          return Promise.resolve();
        }

        const data = {
          distractors: row.distractors,
          explanation: row.explanation,
          ordersOwedAt: row.ordersOwedAt,
          otherSentenceOrders: row.otherSentenceOrders,
          otherTranslationOrders: row.otherTranslationOrders,
          position,
          translation: row.translation,
          translationDistractors: row.translationDistractors,
          ...provenance,
        };

        return tx.lessonSentence.upsert({
          create: { lessonId, sentenceId: row.id, ...data },
          update: data,
          where: { lessonId_sentenceId: { lessonId, sentenceId: row.id } },
        });
      }),
    );
  }

  await tx.step.createMany({
    data: after.screens.map(
      ({
        variants: _variants,
        sources: _sources,
        optionPictures: _pictures,
        answerExplanations: _answers,
        sharedTutorAnswers: _tutor,
        marks,
        ...screen
      }) => ({ ...screen, lessonId, marks: marks ?? DbNull, version, ...provenance }),
    ),
  });

  await Promise.all([
    tx.stepVariant.createMany({
      data: after.screens.flatMap(({ id, variants }) =>
        variants.map((row) => ({ ...row, ...provenance, stepId: id })),
      ),
    }),
    tx.stepOptionPicture.createMany({
      data: after.screens.flatMap(({ id, optionPictures }) =>
        optionPictures.map((row) => ({ ...row, stepId: id })),
      ),
    }),
    tx.stepSource.createMany({
      data: after.screens.flatMap(({ id, sources }) =>
        sources.map((row) => ({ ...row, stepId: id })),
      ),
    }),
    tx.answerExplanation.createMany({
      data: after.screens.flatMap(({ id, answerExplanations }) =>
        answerExplanations.map((row) => ({ ...row, stepId: id })),
      ),
    }),
    tx.tutorSharedAnswer.createMany({
      data: after.screens.flatMap(({ id, sharedTutorAnswers }) =>
        sharedTutorAnswers.map((row) => ({ ...row, stepId: id })),
      ),
    }),
  ]);

  const removed = screenItemIds(before).filter((id) => !screenItemIds(after).includes(id));

  if (removed.length > 0) {
    await retireUnaskedQuestions(
      tx,
      { itemId: { in: removed }, lessonId },
      { sourcesLocked: true },
    );
  }
}
