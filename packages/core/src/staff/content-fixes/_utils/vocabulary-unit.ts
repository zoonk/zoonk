import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { copySpokenSentence } from "../../../library/language/_utils/language-lesson-steps";
import { CURRENT_STEPS } from "../../../library/lessons/lesson-versions";
import { type ContentFixEffect, type StoredChange } from "../contract";
import { type FixContext } from "../handlers/fix-handler";
import { deleteWrittenFromScreen, writtenFromScreen } from "../handlers/screens";
import { type FixUnit } from "./resolved-change";
import { readVoiceTarget } from "./vocabulary-voice";

type VocabularyUnit = { id: string; kind: "sentence" | "word" };

export function isVocabularyUnit(unit: FixUnit): unit is VocabularyUnit {
  return unit.kind === "word" || unit.kind === "sentence";
}

function uniqueIds(rows: readonly { lessonId: string }[]): string[] {
  return [...new Set(rows.map((row) => row.lessonId))].toSorted();
}

/**
 * Every lesson that shows the word or sentence: those that teach it and, for a word, those whose
 * tiles find it by its text. Each one's version moves when the row changes.
 */
export async function findLessonsShowing(
  db: TransactionClient,
  unit: VocabularyUnit,
): Promise<string[]> {
  const select = { lessonId: true } as const;

  if (unit.kind === "sentence") {
    const [links, steps] = await Promise.all([
      db.lessonSentence.findMany({ select, where: { sentenceId: unit.id } }),
      db.step.findMany({ select, where: { sentenceId: unit.id, ...CURRENT_STEPS } }),
    ]);

    return uniqueIds([...links, ...steps]);
  }

  const word = await db.word.findUnique({
    select: { targetLanguage: true, word: true },
    where: { id: unit.id },
  });

  const tile = {
    distractors: { has: word?.word ?? "" },
    lesson: { targetLanguage: word?.targetLanguage ?? "" },
  };

  const rows = await Promise.all([
    db.lessonWord.findMany({ select, where: { wordId: unit.id } }),
    db.step.findMany({ select, where: { wordId: unit.id, ...CURRENT_STEPS } }),
    db.lessonWord.findMany({ select, where: tile }),
    db.lessonSentence.findMany({ select, where: tile }),
  ]);

  return uniqueIds(rows.flat());
}

function changedFieldsOf(change: StoredChange): string[] {
  return change.op === "set" && "fields" in change ? change.fields.map((field) => field.field) : [];
}

function lessonOf(change: StoredChange): string | null {
  return "lessonId" in change && typeof change.lessonId === "string" ? change.lessonId : null;
}

/** The screens that show what the changes write: a shared row's in every lesson, a lesson row's in its own. */
function screensWhere(change: StoredChange) {
  if (change.op !== "set") {
    return null;
  }

  const lessonId = lessonOf(change);
  const scope = { ...CURRENT_STEPS, ...(lessonId ? { lessonId } : {}) };

  if (change.model === "Word" || change.model === "LessonWord") {
    return { ...scope, wordId: change.id };
  }

  return change.model === "Sentence" || change.model === "LessonSentence"
    ? { ...scope, sentenceId: change.id }
    : null;
}

async function findShowingScreens(
  db: TransactionClient,
  changes: readonly StoredChange[],
): Promise<string[]> {
  const where = changes.flatMap((change) => screensWhere(change) ?? []);

  if (where.length === 0) {
    return [];
  }

  const steps = await db.step.findMany({ select: { id: true }, where: { OR: where } });
  return [...new Set(steps.map((step) => step.id))].toSorted();
}

/** A spoken screen copies its sentence's text and romanization and its lesson's translation. */
function copiedWhere(change: StoredChange) {
  const fields = changedFieldsOf(change);

  if (change.model === "Sentence" && fields.length > 0) {
    return { sentenceId: change.id };
  }

  const lessonId = lessonOf(change);

  return change.model === "LessonSentence" && lessonId && fields.includes("translation")
    ? { lessonId, sentenceId: change.id }
    : null;
}

function findCopyingScreens(db: TransactionClient, changes: readonly StoredChange[]) {
  const where = changes.flatMap((change) => copiedWhere(change) ?? []);

  return where.length === 0
    ? Promise.resolve([])
    : db.step.findMany({
        orderBy: { id: "asc" },
        select: { content: true, id: true, lessonId: true, sentenceId: true },
        where: { OR: where, kind: "spokenAnswer", ...CURRENT_STEPS },
      });
}

/** Word orders are built from a sentence's text and its lesson's translation. */
function ordersWhere(change: StoredChange) {
  const fields = changedFieldsOf(change);
  const lessonId = lessonOf(change);

  if (change.model === "Sentence" && fields.includes("sentence")) {
    return { sentenceId: change.id };
  }

  return change.model === "LessonSentence" && lessonId && fields.includes("translation")
    ? { lessonId, sentenceId: change.id }
    : null;
}

async function findOwedOrders(db: TransactionClient, changes: readonly StoredChange[]) {
  const where = changes.flatMap((change) => ordersWhere(change) ?? []);

  if (where.length === 0) {
    return { lessonIds: [], where };
  }

  const rows = await db.lessonSentence.findMany({
    select: { lessonId: true },
    where: { OR: where },
  });

  return { lessonIds: uniqueIds(rows), where };
}

async function keptPronunciations(
  db: TransactionClient,
  changes: readonly StoredChange[],
): Promise<ContentFixEffect[]> {
  const word = changes.find(
    (change) => change.model === "Word" && changedFieldsOf(change).includes("word"),
  );

  if (!word) {
    return [];
  }

  const count = await db.wordPronunciation.count({
    where: {
      id: {
        notIn: changes
          .filter((change) => change.model === "WordPronunciation")
          .map((change) => change.id),
      },
      wordId: word.id,
    },
  });

  return count > 0 ? [{ count, kind: "pronunciationsKept", wordId: word.id }] : [];
}

/** What a word or sentence fix does besides its own rows, shown before it's approved. */
export async function vocabularyEffects(
  db: TransactionClient,
  { changes, unit }: { changes: readonly StoredChange[]; unit: VocabularyUnit },
): Promise<ContentFixEffect[]> {
  const [lessonIds, screens, copying, orders, voice, pronunciations] = await Promise.all([
    findLessonsShowing(db, unit),
    findShowingScreens(db, changes),
    findCopyingScreens(db, changes),
    findOwedOrders(db, changes),
    readVoiceTarget(db, changes),
    keptPronunciations(db, changes),
  ]);

  const written = await Promise.all(screens.map((stepId) => writtenFromScreen(db, stepId)));

  return [
    ...(voice ? [{ id: voice.id, kind: "voiceOwed" as const, model: voice.model }] : []),
    ...(lessonIds.length > 0 ? [{ kind: "lessonsUpdated" as const, lessonIds }] : []),
    ...(copying.length > 0
      ? [{ kind: "spokenScreensCopied" as const, stepIds: copying.map((step) => step.id) }]
      : []),
    ...(orders.lessonIds.length > 0
      ? [{ kind: "sentenceOrdersOwed" as const, lessonIds: orders.lessonIds }]
      : []),
    ...pronunciations,
    ...written.flat(),
  ];
}

async function copySpokenScreens(tx: TransactionClient, changes: readonly StoredChange[]) {
  const screens = await findCopyingScreens(tx, changes);

  for (const screen of screens) {
    // oxlint-disable-next-line no-await-in-loop -- writes share one transaction's connection
    const link = await tx.lessonSentence.findUnique({
      select: { sentence: { select: { romanization: true, sentence: true } }, translation: true },
      where: {
        lessonId_sentenceId: { lessonId: screen.lessonId, sentenceId: screen.sentenceId ?? "" },
      },
    });

    if (link && isJsonObject(screen.content)) {
      const { romanization: _romanization, translation: _translation, ...kept } = screen.content;

      // oxlint-disable-next-line no-await-in-loop -- writes share one transaction's connection
      await tx.step.update({
        data: {
          content: {
            ...kept,
            ...copySpokenSentence({ ...link.sentence, translation: link.translation }),
          },
        },
        where: { id: screen.id },
      });
    }
  }
}

async function oweSentenceOrders(
  tx: TransactionClient,
  { changes, context }: { changes: readonly StoredChange[]; context: FixContext },
) {
  const orders = await findOwedOrders(tx, changes);

  if (orders.lessonIds.length === 0) {
    return;
  }

  await tx.lessonSentence.updateMany({
    data: { ordersOwedAt: context.now, otherSentenceOrders: [], otherTranslationOrders: [] },
    where: { OR: orders.where },
  });

  await tx.lesson.updateMany({
    data: { sentenceOrdersAttempts: 0 },
    where: { id: { in: orders.lessonIds } },
  });

  const fix = await tx.contentFix.findUniqueOrThrow({
    select: { deciderId: true },
    where: { id: context.fixId },
  });

  if (!fix.deciderId) {
    throw new Error("Owed word orders need the staff approver.");
  }

  await oweFollowUps({
    db: tx,
    followUps: orders.lessonIds.map((lessonId) => ({
      input: { lessonId },
      kind: "writeSentenceOrders" as const,
    })),
    userId: fix.deciderId,
  });
}

/**
 * What a word or sentence fix writes besides its own rows, recomputed from the rows as fixed, so
 * applying a revert puts them back the same way: spoken screens copy the sentence again, word
 * orders are owed again, answers written from the old screens go, and every lesson showing it
 * moves its version. Lessons are written before their screens, in the order publishing locks them.
 */
export async function applyVocabularyUnit(
  tx: TransactionClient,
  {
    changes,
    context,
    unit,
  }: { changes: readonly StoredChange[]; context: FixContext; unit: VocabularyUnit },
): Promise<void> {
  await tx.lesson.updateMany({
    data: { updatedAt: context.now },
    where: { id: { in: await findLessonsShowing(tx, unit) } },
  });

  const screens = await findShowingScreens(tx, changes);

  for (const stepId of screens) {
    // oxlint-disable-next-line no-await-in-loop -- writes share one transaction's connection
    await deleteWrittenFromScreen(tx, stepId);
  }

  await copySpokenScreens(tx, changes);
  await oweSentenceOrders(tx, { changes, context });
}
