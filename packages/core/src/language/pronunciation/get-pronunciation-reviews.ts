import "server-only";
import { prisma } from "@zoonk/db";
import { resolveViewGoal } from "../../view-models/_utils/resolve-view-goal";
import { type PronunciationReviewsView } from "./pronunciation-contract";
import { MAX_PRONUNCIATION_ROUND_WORDS } from "./pronunciation-rules";

export type PronunciationReviewsResult =
  | { reviews: PronunciationReviewsView; status: "ready" }
  | { status: "noGoal" | "notFound" | "notLanguage" | "unauthorized" };

/** Reviews due by now in one language, the longest-waiting first. */
export function findDuePronunciationReviews({
  language,
  now,
  take,
  userId,
}: {
  language: string;
  now: Date;
  take?: number;
  userId: string;
}) {
  return prisma.pronunciationReview.findMany({
    include: { word: { include: { pronunciations: true } } },
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    take,
    where: { dueAt: { lte: now }, language, userId },
  });
}

/**
 * The words a language goal's learner mispronounced that are due to come back today, with what
 * helps say them: the native recording, the respelling and tip for the learner's language, and
 * the romanization. A round asks a few at a time; the others wait for the next one.
 */
export async function getPronunciationReviews(
  input: { goalId?: string } = {},
): Promise<PronunciationReviewsResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(input.goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;
  const { userId } = goal;

  if (goal.kind !== "language" || !goal.targetLanguage) {
    return { status: "notLanguage" };
  }

  const rows = await findDuePronunciationReviews({
    language: goal.targetLanguage,
    now: new Date(),
    take: MAX_PRONUNCIATION_ROUND_WORDS,
    userId,
  });

  return {
    reviews: {
      goalId: goal.id,
      language: goal.targetLanguage,
      words: rows.map((row) => {
        const guide = row.word.pronunciations.find(
          (pronunciation) => pronunciation.userLanguage === row.userLanguage,
        );

        return {
          audioUrl: row.word.audioUrl,
          id: row.id,
          respelling: guide?.pronunciation ?? null,
          romanization: row.word.romanization,
          tip: guide?.tip ?? null,
          word: row.word.word,
        };
      }),
    },
    status: "ready",
  };
}
