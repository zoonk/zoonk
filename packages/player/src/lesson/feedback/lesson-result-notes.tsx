"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CalendarClockIcon, NotebookPenIcon, RotateCcwIcon, ZapIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { type ReviewDate, describeReviewDate } from "../_utils/review-date";

function getDayLabel(review: ReviewDate): string {
  return "label" in review ? review.label : "";
}

function ResultNote({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: typeof CalendarClockIcon;
}) {
  return (
    <p className="text-muted-foreground flex items-start gap-2 px-1 text-sm">
      <LineMarker>
        <Icon aria-hidden="true" className="size-4" />
      </LineMarker>
      <span>{children}</span>
    </p>
  );
}

/** A miss saved to the mistakes notebook, and when it comes back, in one line. */
function SavedMistakeNote({
  review,
  willReturn,
}: {
  review: ReviewDate | null;
  willReturn: boolean;
}) {
  const t = useExtracted();

  if (willReturn) {
    return (
      <ResultNote icon={NotebookPenIcon}>
        {t("Saved to your mistakes · back at the end of this lesson")}
      </ResultNote>
    );
  }

  if (!review) {
    return <ResultNote icon={NotebookPenIcon}>{t("Saved to your mistakes")}</ResultNote>;
  }

  return (
    <ResultNote icon={NotebookPenIcon}>
      {t(
        "Saved to your mistakes · back {when, select, today {in a review later today} tomorrow {in tomorrow's review} weekday {in {day}'s review} other {in a review on {day}}}",
        { day: getDayLabel(review), when: review.kind },
      )}
    </ResultNote>
  );
}

/** When the idea comes back, after an answer that wasn't saved as a mistake. */
function ComesBackNote({ review, willReturn }: { review: ReviewDate | null; willReturn: boolean }) {
  const t = useExtracted();

  if (willReturn) {
    return (
      <ResultNote icon={RotateCcwIcon}>
        {t("This question comes back at the end of the lesson")}
      </ResultNote>
    );
  }

  if (!review) {
    return null;
  }

  return (
    <ResultNote icon={CalendarClockIcon}>
      {t(
        "This idea comes back {when, select, today {in a review later today} tomorrow {in tomorrow's review} weekday {in {day}'s review} other {in a review on {day}}}",
        { day: getDayLabel(review), when: review.kind },
      )}
    </ResultNote>
  );
}

/**
 * The quiet lines under a result: Hyperdrive from three right answers in a row, then one line on
 * what happens next (saved to the mistakes notebook, coming back at the end of the lesson or in a
 * review). None of it costs anything.
 */
export function LessonResultNotes({
  hyperdriveStreak,
  nextReviewAt,
  savedMistake,
  willReturn,
}: {
  hyperdriveStreak: number | null;
  nextReviewAt: string | null;
  savedMistake: boolean;
  willReturn: boolean;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const review = nextReviewAt ? describeReviewDate({ locale, reviewAt: nextReviewAt }) : null;

  return (
    <div className="flex flex-col gap-2 empty:hidden" data-slot="lesson-result-notes">
      {hyperdriveStreak !== null && (
        <ResultNote icon={ZapIcon}>
          <span data-slot="lesson-hyperdrive">
            {t("{count} right in a row", { count: String(hyperdriveStreak) })}
          </span>
        </ResultNote>
      )}

      {savedMistake ? (
        <SavedMistakeNote review={review} willReturn={willReturn} />
      ) : (
        <ComesBackNote review={review} willReturn={willReturn} />
      )}
    </div>
  );
}
