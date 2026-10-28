import "server-only";
import { findDuePronunciationReviews } from "./get-pronunciation-reviews";

const NAMED_WORDS = 3;

export async function loadDuePronunciation({
  language,
  userId,
}: {
  language: string;
  userId: string;
}): Promise<{ count: number; words: string[] } | null> {
  const due = await findDuePronunciationReviews({ language, now: new Date(), userId });

  if (due.length === 0) {
    return null;
  }

  return { count: due.length, words: due.slice(0, NAMED_WORDS).map((review) => review.word.word) };
}
