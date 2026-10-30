"use client";

import { FeedbackNote } from "@zoonk/learn/feedback-panel";
import { useExtracted, useLocale } from "next-intl";
import { type ReviewDate, describeReviewDate } from "../_utils/review-date";

export type LessonResultNext = {
  nextReviewAt: string | null;
  savedMistake: boolean;
  willReturn: boolean;
};

function getDayLabel(review: ReviewDate): string {
  return "label" in review ? review.label : "";
}

function useReview(nextReviewAt: string | null): ReviewDate | null {
  const locale = useLocale();
  return nextReviewAt ? describeReviewDate({ locale, reviewAt: nextReviewAt }) : null;
}

function ResultNextText({
  review,
  savedMistake,
  willReturn,
}: {
  review: ReviewDate | null;
  savedMistake: boolean;
  willReturn: boolean;
}) {
  const t = useExtracted();

  if (savedMistake && willReturn) {
    return t({
      description:
        "“your mistakes” is the learner's Mistakes notebook, in lowercase as in the English.",
      message: "Saved to your mistakes · back at the end of this lesson",
    });
  }

  if (savedMistake && !review) {
    return t({
      description:
        "“your mistakes” is the learner's Mistakes notebook, in lowercase as in the English.",
      message: "Saved to your mistakes",
    });
  }

  if (savedMistake && review) {
    return t({
      description:
        "“your mistakes” is the learner's Mistakes notebook, in lowercase as in the English.",
      message:
        "Saved to your mistakes · back {when, select, today {in a review later today} tomorrow {in tomorrow's review} weekday {in {day}'s review} other {in a review on {day}}}",
      values: { day: getDayLabel(review), when: review.kind },
    });
  }

  if (willReturn) {
    return t("This question comes back at the end of the lesson");
  }

  if (!review) {
    return null;
  }

  return t(
    "This idea comes back {when, select, today {in a review later today} tomorrow {in tomorrow's review} weekday {in {day}'s review} other {in a review on {day}}}",
    { day: getDayLabel(review), when: review.kind },
  );
}

export function HyperdriveStreak({ count }: { count: number }) {
  const t = useExtracted();

  return (
    <span data-slot="lesson-hyperdrive">
      {t("{count} right in a row", { count: String(count) })}
    </span>
  );
}

export function LessonResultNote({ nextReviewAt, savedMistake, willReturn }: LessonResultNext) {
  const review = useReview(nextReviewAt);

  if (!savedMistake && !willReturn && !review) {
    return null;
  }

  return (
    <FeedbackNote>
      <ResultNextText review={review} savedMistake={savedMistake} willReturn={willReturn} />
    </FeedbackNote>
  );
}

export function LessonResultNotes({
  hyperdriveStreak,
  nextReviewAt,
  savedMistake,
  willReturn,
}: LessonResultNext & { hyperdriveStreak: number | null }) {
  const review = useReview(nextReviewAt);
  const hasNext = savedMistake || willReturn || review !== null;

  if (hyperdriveStreak === null && !hasNext) {
    return null;
  }

  return (
    <FeedbackNote data-slot="lesson-result-notes">
      {hyperdriveStreak !== null && <HyperdriveStreak count={hyperdriveStreak} />}
      {hyperdriveStreak !== null && hasNext && " · "}
      {hasNext && (
        <ResultNextText review={review} savedMistake={savedMistake} willReturn={willReturn} />
      )}
    </FeedbackNote>
  );
}
