import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateLanguageSentenceOrders } from "@zoonk/ai/tasks/language/language-sentence-orders";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isSameLanguage } from "@zoonk/utils/languages";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { type SentenceOrders, keepSentenceOrders } from "./sentence-orders";

type Analytics = Parameters<typeof generateLanguageSentenceOrders>[0]["analytics"];

const ORDERS_TIER = chooseServiceTier({ wait: "later" });

/** Every try claims one, a step's retries included, so two runs' tries end a failure no retry fixes. */
const MAX_ATTEMPTS = 8;
const OWED_LESSONS_PER_SWEEP = 100;

const owesOrders = {
  sentenceOrdersAttempts: { lt: MAX_ATTEMPTS },
  sentenceOrdersOwedAt: { not: null },
};

export type OwedSentenceOrdersStatus = "changed" | "skipped" | "written";

class SentencesChangedError extends Error {
  override name = "SentencesChangedError";
}

function readSentences(client: TransactionClient, lessonId: string) {
  return client.lessonSentence.findMany({
    orderBy: { position: "asc" },
    select: { sentence: { select: { sentence: true } }, sentenceId: true, translation: true },
    where: { lessonId },
  });
}

type LessonSentences = Awaited<ReturnType<typeof readSentences>>;

function toSentencesKey(sentences: LessonSentences): string {
  return JSON.stringify(
    sentences.map((item) => [item.sentenceId, item.sentence.sentence, item.translation]),
  );
}

/**
 * Raw, so claiming an attempt leaves `updatedAt` alone: it tells clients the lesson changed, and
 * nothing a learner sees has yet.
 */
async function claimAttempt(lessonId: string): Promise<boolean> {
  const claimed = await prisma.$executeRaw`
    UPDATE library_lessons
    SET sentence_orders_attempts = sentence_orders_attempts + 1
    WHERE id = ${lessonId}::uuid
      AND sentence_orders_owed_at IS NOT NULL
      AND sentence_orders_attempts < ${MAX_ATTEMPTS}
  `;

  return claimed > 0;
}

async function readOwedLesson(lessonId: string) {
  const [lesson, sentences] = await Promise.all([
    prisma.lesson.findUnique({
      select: { language: true, targetLanguage: true },
      where: { id: lessonId },
    }),
    readSentences(prisma, lessonId),
  ]);

  return lesson?.targetLanguage
    ? { learnerLanguage: lesson.language, sentences, targetLanguage: lesson.targetLanguage }
    : null;
}

async function writeOrders({
  lessonId,
  orders,
  sentences,
}: {
  lessonId: string;
  orders: SentenceOrders[];
  sentences: LessonSentences;
}): Promise<boolean> {
  const { error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      const cleared = await tx.lesson.updateMany({
        data: { sentenceOrdersOwedAt: null },
        where: { id: lessonId, sentenceOrdersOwedAt: { not: null } },
      });

      if (
        cleared.count === 0 ||
        toSentencesKey(await readSentences(tx, lessonId)) !== toSentencesKey(sentences)
      ) {
        throw new SentencesChangedError();
      }

      await Promise.all(
        sentences.map((item, index) =>
          tx.lessonSentence.update({
            data: {
              otherSentenceOrders: orders[index]?.otherOrders ?? [],
              otherTranslationOrders: orders[index]?.otherTranslationOrders ?? [],
            },
            where: { lessonId_sentenceId: { lessonId, sentenceId: item.sentenceId } },
          }),
        ),
      );
    }),
  );

  if (error instanceof SentencesChangedError) {
    return false;
  }

  if (error) {
    throw error;
  }

  revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  return true;
}

async function writeOwedOrders({
  analytics,
  lesson,
  lessonId,
}: {
  analytics?: Analytics;
  lesson: NonNullable<Awaited<ReturnType<typeof readOwedLesson>>>;
  lessonId: string;
}): Promise<boolean> {
  if (lesson.sentences.length === 0) {
    return writeOrders({ lessonId, orders: [], sentences: [] });
  }

  const sameLanguage = isSameLanguage(lesson);

  const { data } = await generateLanguageSentenceOrders({
    analytics: { contentScope: "shared", ...analytics },
    learnerLanguage: lesson.learnerLanguage,
    sentences: lesson.sentences.map((item) => ({
      sentence: item.sentence.sentence,
      translation: item.translation,
    })),
    serviceTier: ORDERS_TIER,
    targetLanguage: lesson.targetLanguage,
  });

  if (data.sentences.length !== lesson.sentences.length) {
    throw new Error("Sentence orders must include one result per requested sentence, in order.");
  }

  const orders = lesson.sentences.map((item, index) =>
    keepSentenceOrders({
      sameLanguage,
      sentence: {
        ...data.sentences[index],
        sentence: item.sentence.sentence,
        translation: item.translation,
      },
    }),
  );

  return writeOrders({ lessonId, orders, sentences: lesson.sentences });
}

/**
 * Internal workflow bridge: writes the other word orders of a lesson written before it had them.
 * The caller holds the lesson's run token. A lesson rewritten meanwhile keeps what its new write
 * wrote.
 */
export async function writeOwedSentenceOrders({
  analytics,
  lessonId,
}: {
  analytics?: Analytics;
  lessonId: string;
}): Promise<OwedSentenceOrdersStatus> {
  if (!(await claimAttempt(lessonId))) {
    return "skipped";
  }

  const lesson = await readOwedLesson(lessonId);

  if (!lesson) {
    return "skipped";
  }

  return (await writeOwedOrders({ analytics, lesson, lessonId })) ? "written" : "changed";
}

/** Internal bridge for the daily sweep. */
export async function listOwedSentenceOrders(): Promise<string[]> {
  const lessons = await prisma.lesson.findMany({
    orderBy: { sentenceOrdersOwedAt: "asc" },
    select: { id: true },
    take: OWED_LESSONS_PER_SWEEP,
    where: owesOrders,
  });

  return lessons.map((lesson) => lesson.id);
}
