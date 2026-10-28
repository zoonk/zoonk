import "server-only";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { after } from "next/server";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { fillMissingAudio } from "../../library/language/_utils/language-audio";
import { schedulePronunciationMiss, toReviewWord } from "./pronunciation-rules";

type ReviewWord = { audioUrl: string | null; id: string; word: string };

function findWords({
  targetLanguage,
  texts,
}: {
  targetLanguage: string;
  texts: readonly string[];
}) {
  return prisma.word.findMany({
    orderBy: { createdAt: "asc" },
    select: { audioUrl: true, id: true, word: true },
    where: {
      OR: texts.map((text) => ({ word: { equals: text, mode: "insensitive" as const } })),
      targetLanguage,
    },
  });
}

function pickWord({ rows, text }: { rows: readonly ReviewWord[]; text: string }) {
  const copies = rows.filter((row) => row.word.toLowerCase() === text.toLowerCase());
  return copies.find((row) => row.audioUrl) ?? copies[0] ?? null;
}

async function findOrCreateWords({
  targetLanguage,
  texts,
}: {
  targetLanguage: string;
  texts: readonly string[];
}): Promise<{ orgSlug: string | null; words: ReviewWord[] }> {
  const existing = await findWords({ targetLanguage, texts });
  const missing = texts.filter((text) => !pickWord({ rows: existing, text }));
  const organization = await prisma.organization.findUnique({ where: { slug: AI_ORG_SLUG } });

  if (missing.length > 0 && organization) {
    await prisma.word.createMany({
      data: missing.map((word) => ({ organizationId: organization.id, targetLanguage, word })),
      skipDuplicates: true,
    });
  }

  const rows = missing.length > 0 ? await findWords({ targetLanguage, texts }) : existing;
  const picked = texts.flatMap((text) => pickWord({ rows, text }) ?? []);
  const words = [...new Map(picked.map((word) => [word.id, word])).values()];

  return { orgSlug: organization?.slug ?? null, words };
}

/** Internal grader bridge: the caller must already have authorized the session and answer. */
export async function schedulePronunciationReviews({
  targetLanguage,
  timeZone,
  userId,
  userLanguage,
  words,
}: {
  targetLanguage: string;
  timeZone: string;
  userId: string;
  userLanguage: string;
  words: readonly string[];
}): Promise<string[]> {
  const texts = [...new Set(words.map((word) => toReviewWord(word)).filter(Boolean))];

  if (texts.length === 0) {
    return [];
  }

  const { orgSlug, words: rows } = await findOrCreateWords({ targetLanguage, texts });

  const schedule = schedulePronunciationMiss({ now: new Date(), timeZone });

  const reviews = await writeLearnerChange({ userId }, async (tx) => {
    const existing = await tx.pronunciationReview.findMany({
      where: { userId, wordId: { in: rows.map((row) => row.id) } },
    });

    const scheduled = rows.map((row) => existing.find((review) => review.wordId === row.id));

    const same = scheduled.every(
      (review) =>
        review &&
        review.stage === schedule.stage &&
        review.dueAt?.getTime() === schedule.dueAt?.getTime() &&
        review.userLanguage === userLanguage,
    );

    if (same) {
      return unchanged(scheduled.flatMap((review) => (review ? [review] : [])));
    }

    return Promise.all(
      rows.map((row) =>
        tx.pronunciationReview.upsert({
          create: { ...schedule, language: targetLanguage, userId, userLanguage, wordId: row.id },
          update: { ...schedule, userLanguage },
          where: { userWord: { userId, wordId: row.id } },
        }),
      ),
    );
  });

  revalidateCacheTags([getLearnerModelCacheTag(userId)]);

  const silent = rows.filter((row) => !row.audioUrl).map((row) => row.id);

  if (orgSlug && silent.length > 0) {
    after(() => fillMissingAudio({ orgSlug, sentenceIds: [], targetLanguage, wordIds: silent }));
  }

  return reviews.map((review) => review.id);
}
