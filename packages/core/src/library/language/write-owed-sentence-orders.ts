import "server-only";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { generateLanguageSentenceOrders } from "@zoonk/ai/tasks/language/language-sentence-orders";
import { type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { isSameLanguage } from "@zoonk/utils/languages";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { type SentenceOrders, checkOrderCandidates, toOrderCandidates } from "./sentence-orders";

type Analytics = Parameters<typeof generateLanguageSentenceOrders>[0]["analytics"];

/** Every try claims one, a step's retries included, so two runs' tries end a failure no retry fixes. */
const MAX_ATTEMPTS = 8;
const OWED_LESSONS_PER_SWEEP = 1000;

export type OwedSentenceOrdersStatus = "changed" | "skipped" | "written";

type OwedSentence = { sentence: string; sentenceId: string; translation: string };

export type SentenceOrderCandidates = {
  candidates: SentenceOrders[];
  learnerLanguage: string;
  sentences: OwedSentence[];
  targetLanguage: string;
};

export type SentenceOrderCandidatesResult =
  | { candidates: SentenceOrderCandidates; status: "generated" }
  | { status: "skipped" };

class SentencesChangedError extends Error {
  override name = "SentencesChangedError";
}

async function readSentences(client: TransactionClient, lessonId: string): Promise<OwedSentence[]> {
  const rows = await client.lessonSentence.findMany({
    orderBy: { position: "asc" },
    select: { sentence: { select: { sentence: true } }, sentenceId: true, translation: true },
    where: { lessonId },
  });

  return rows.map((row) => ({
    sentence: row.sentence.sentence,
    sentenceId: row.sentenceId,
    translation: row.translation,
  }));
}

function toSentencesKey(sentences: readonly OwedSentence[]): string {
  return JSON.stringify(
    sentences.map((item) => [item.sentenceId, item.sentence, item.translation]),
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
      AND EXISTS (
        SELECT 1 FROM lesson_sentences
        WHERE lesson_id = library_lessons.id AND orders_owed_at IS NOT NULL
      )
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
  sentences: readonly OwedSentence[];
}): Promise<boolean> {
  const { error } = await safeAsync(() =>
    prisma.$transaction(async (tx) => {
      await tx.lesson.updateMany({ data: { updatedAt: new Date() }, where: { id: lessonId } });

      const cleared = await tx.lessonSentence.updateMany({
        data: { ordersOwedAt: null },
        where: { lessonId, ordersOwedAt: { not: null } },
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

/**
 * Internal workflow bridge, the first of a lesson's two orders steps: candidate orders a learner can
 * build from its tiles, for `writeCheckedSentenceOrders` to review. The caller holds the lesson's run
 * token.
 */
export async function generateSentenceOrderCandidates({
  analytics,
  lessonId,
  serviceTier,
}: {
  analytics?: Analytics;
  lessonId: string;
  serviceTier?: ServiceTier;
}): Promise<SentenceOrderCandidatesResult> {
  if (!(await claimAttempt(lessonId))) {
    return { status: "skipped" };
  }

  const lesson = await readOwedLesson(lessonId);

  if (!lesson) {
    return { status: "skipped" };
  }

  const { data } = await generateLanguageSentenceOrders({
    analytics: { contentScope: "shared", ...analytics },
    learnerLanguage: lesson.learnerLanguage,
    sentences: lesson.sentences,
    serviceTier,
    targetLanguage: lesson.targetLanguage,
  });

  const candidates = toOrderCandidates({
    generated: data,
    sameLanguage: isSameLanguage(lesson),
    sentences: lesson.sentences,
  });

  return { candidates: { ...lesson, candidates }, status: "generated" };
}

/**
 * Internal workflow bridge, the second step: saves the candidates a native teacher accepts. The
 * caller holds the lesson's run token. A lesson rewritten meanwhile keeps what its new write wrote
 * and still owes its orders.
 */
export async function writeCheckedSentenceOrders({
  analytics,
  candidates,
  lessonId,
  serviceTier,
}: {
  analytics?: Analytics;
  candidates: SentenceOrderCandidates;
  lessonId: string;
  serviceTier?: ServiceTier;
}): Promise<OwedSentenceOrdersStatus> {
  if (!(await claimAttempt(lessonId))) {
    return "skipped";
  }

  const orders = await checkOrderCandidates({
    ...candidates,
    analytics: { contentScope: "shared", ...analytics },
    serviceTier,
  });

  return (await writeOrders({ lessonId, orders, sentences: candidates.sentences }))
    ? "written"
    : "changed";
}

/** Internal bridge for the daily sweep. */
export async function listOwedSentenceOrders(): Promise<string[]> {
  const lessons = await prisma.$queryRaw<{ id: string }[]>`
    SELECT lesson.id
    FROM library_lessons lesson
    JOIN lesson_sentences sentence ON sentence.lesson_id = lesson.id
    WHERE sentence.orders_owed_at IS NOT NULL
      AND lesson.sentence_orders_attempts < ${MAX_ATTEMPTS}
    GROUP BY lesson.id
    ORDER BY (
      SELECT MAX(COALESCE(activity.ended_at, activity.started_at))
      FROM learning_events activity
      WHERE activity.kind = 'lesson'
        AND activity.content_ids @> jsonb_build_object('lessonId', lesson.id::text)
    ) DESC NULLS LAST, MIN(sentence.orders_owed_at) ASC, lesson.id ASC
    LIMIT ${OWED_LESSONS_PER_SWEEP}
  `;

  return lessons.map((lesson) => lesson.id);
}
