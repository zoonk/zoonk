import "server-only";
import { findDuePronunciationReviews } from "./get-pronunciation-reviews";

/** Words named on a row of words to say again; the count covers the rest. */
const NAMED_WORDS = 3;

/** Mispronounced words in one language due to be said again, named by the first few. */
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
