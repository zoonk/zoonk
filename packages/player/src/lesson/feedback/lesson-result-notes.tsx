"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CalendarClockIcon, NotebookPenIcon, RotateCcwIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { describeReviewDate } from "../_utils/review-date";

function ResultNote({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: typeof CalendarClockIcon;
}) {
  return (
    <p className="bg-muted/60 text-muted-foreground flex items-start gap-2 rounded-xl px-3 py-2 text-sm">
      <LineMarker>
        <Icon aria-hidden="true" className="size-4" />
      </LineMarker>
      <span>{children}</span>
    </p>
  );
}

function ReviewNote({ reviewAt }: { reviewAt: string }) {
  const t = useExtracted();
  const locale = useLocale();
  const when = describeReviewDate({ locale, reviewAt });

  if (when.kind === "today") {
    return (
      <ResultNote icon={CalendarClockIcon}>
        {t("This idea comes back in a review later today")}
      </ResultNote>
    );
  }

  if (when.kind === "tomorrow") {
    return (
      <ResultNote icon={CalendarClockIcon}>
        {t("This idea comes back in tomorrow's review")}
      </ResultNote>
    );
  }

  return (
    <ResultNote icon={CalendarClockIcon}>
      {t("This idea comes back in a review on {day}", { day: when.label })}
    </ResultNote>
  );
}

/**
 * The quiet lines under a result: when the idea comes back, that a miss went to the mistakes
 * notebook, and that a missed question returns at the end of the lesson. None of it costs anything.
 */
export function LessonResultNotes({
  nextReviewAt,
  savedMistake,
  willReturn,
}: {
  nextReviewAt: string | null;
  savedMistake: boolean;
  willReturn: boolean;
}) {
  const t = useExtracted();

  if (!nextReviewAt && !savedMistake && !willReturn) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2" data-slot="lesson-result-notes">
      {willReturn && (
        <ResultNote icon={RotateCcwIcon}>
          {t("This question comes back at the end of the lesson")}
        </ResultNote>
      )}

      {savedMistake && (
        <ResultNote icon={NotebookPenIcon}>
          {t("Saved to your mistakes to practice later")}
        </ResultNote>
      )}

      {nextReviewAt && !willReturn && <ReviewNote reviewAt={nextReviewAt} />}
    </div>
  );
}
