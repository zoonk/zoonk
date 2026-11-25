import { isDeepStrictEqual } from "node:util";
import { DbNull, type TransactionClient, sql } from "@zoonk/db";
import { toStoredItem } from "../../../../library/items/item-content";
import {
  matchCheckQuestion,
  updateCheckQuestion,
} from "../../../../library/lessons/_utils/screen-question-item";
import {
  retireUnaskedQuestions,
  startLessonVersion,
} from "../../../../library/lessons/lesson-versions";
import { toCheckQuestion } from "../../../../library/steps/_utils/check-question";
import { type FixContext } from "../fix-handler";
import { linkVocabularyMedia, resolvePublishedScreens } from "./link-media";
import { screenItemIds } from "./references";
import { type ScreenSnapshot, type StoredScreens } from "./schema";

async function copyKeptAnswers(tx: TransactionClient, { after, proposal }: StoredScreens) {
  const copies = (proposal?.screens ?? []).flatMap((entry, position) => {
    const next = after.screens[position];
    return "id" in entry && next?.provenance ? [{ from: entry.id, to: next.id }] : [];
  });

  if (copies.length === 0) {
    return;
  }

  await tx.$executeRaw(sql`
    WITH screen_copies AS (
      SELECT * FROM unnest(${copies.map(({ from }) => from)}::uuid[], ${copies.map(({ to }) => to)}::uuid[])
        AS copies(source_id, target_id)
    ),
    copied_explanations AS (
      INSERT INTO answer_explanations
        (step_id, language, normalized_answer, explanation, model, prompt_version, run_id, generated_at)
      SELECT target_id, language, normalized_answer, explanation, model, prompt_version, run_id, generated_at
      FROM answer_explanations
      JOIN screen_copies ON step_id = source_id
    )
    INSERT INTO tutor_shared_answers
      (step_id, suggestion, question, answer, model, prompt_version, run_id, generated_at)
    SELECT target_id, suggestion, question, answer, model, prompt_version, run_id, generated_at
    FROM tutor_shared_answers
    JOIN screen_copies ON step_id = source_id
  `);
}

async function updateKeptCheckQuestions(tx: TransactionClient, after: ScreenSnapshot) {
  const checks = after.screens.filter((screen) => screen.kind === "check" && screen.itemId);

  if (checks.length === 0) {
    return;
  }

  const items = await tx.item.findMany({
    select: { content: true, format: true, id: true, skillId: true },
    where: { format: "multipleChoice", id: { in: checks.flatMap(({ itemId }) => itemId ?? []) } },
  });

  await Promise.all(
    items.map(async (item) => {
      const screen = checks.find(({ itemId }) => itemId === item.id);
      const question = screen && toCheckQuestion(screen.content);
      const content = question && matchCheckQuestion(item.content, question);

      if (content) {
        await updateCheckQuestion(tx, item, content);
      }
    }),
  );
}

export async function applyLessonScreens(
  tx: TransactionClient,
  change: StoredScreens,
  context: FixContext,
) {
  const { id: lessonId, before } = change;
  const after = resolvePublishedScreens(change, context);
  const provenance = { model: "staff", promptVersion: "setScreens", runId: context.fixId };
  const version = await startLessonVersion(tx, lessonId);

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

  await updateKeptCheckQuestions(tx, after);

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

  await linkVocabularyMedia(tx, change, context);

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
        marks,
        provenance: origin,
        ...screen
      }) => ({ ...screen, ...origin, lessonId, marks: marks ?? DbNull, version }),
    ),
  });

  await Promise.all([
    tx.stepVariant.createMany({
      data: after.screens.flatMap(({ id, variants }) =>
        variants.map(({ provenance: origin, ...row }) => ({ ...row, ...origin, stepId: id })),
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
    copyKeptAnswers(tx, change),
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
