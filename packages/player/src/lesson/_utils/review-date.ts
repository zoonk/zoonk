import { MS_PER_DAY } from "@zoonk/utils/date";

const DAYS_IN_A_WEEK = 7;

export type ReviewDate =
  | { kind: "date"; label: string }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "weekday"; label: string };

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * When a review falls, in the words a learner uses: today, tomorrow, a weekday within the week,
 * or a date further out. Days follow the device's clock, like the rest of the learner's day.
 */
export function describeReviewDate({
  locale,
  now = new Date(),
  reviewAt,
}: {
  locale: string;
  now?: Date;
  reviewAt: string;
}): ReviewDate {
  const review = new Date(reviewAt);
  const days = Math.round((startOfDay(review) - startOfDay(now)) / MS_PER_DAY);

  if (days <= 0) {
    return { kind: "today" };
  }

  if (days === 1) {
    return { kind: "tomorrow" };
  }

  if (days < DAYS_IN_A_WEEK) {
    return {
      kind: "weekday",
      label: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(review),
    };
  }

  return {
    kind: "date",
    label: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(review),
  };
}
