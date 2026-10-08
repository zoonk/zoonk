import { getProgressDayCountLabel } from "@/components/progress/progress-day-count-label";
import { getProgressLearningTimeLabel } from "@/components/progress/progress-learning-time-label";
import { type LearningActivityData } from "@zoonk/core/progress/get-learning-activity";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import { ProgressHeadline, ProgressHeadlineValue } from "../_components/progress-headline";

/** Leads Activity with the learner's study days, the same days the calendar lights. */
export async function ActivityStats({ learningDays }: { learningDays: number }) {
  return (
    <ProgressHeadline>
      <ProgressHeadlineValue className="text-info">
        {await getProgressDayCountLabel({ count: learningDays })}
      </ProgressHeadlineValue>
    </ProgressHeadline>
  );
}

/** One sentence under the calendar: the lessons finished and the time it all took. */
export async function ActivityTotalsLine({
  totals,
}: {
  totals: Pick<LearningActivityData, "totalLearningSeconds" | "totalLessonCompletions">;
}) {
  const t = await getExtracted();

  const time = await getProgressLearningTimeLabel({ totalSeconds: totals.totalLearningSeconds });

  return (
    <p className="text-muted-foreground text-sm">
      {t(
        "{lessons, plural, =0 {# lessons finished} one {# lesson finished} other {# lessons finished}} and {time} of study in total.",
        { lessons: totals.totalLessonCompletions, time },
      )}
    </p>
  );
}

/** Mirrors the study days headline while private progress data streams. */
export function ActivityStatsSkeleton() {
  return (
    <ProgressHeadline>
      <Skeleton className="h-12 w-48" />
    </ProgressHeadline>
  );
}
