import { getProgressLessonCountLabel } from "@/components/progress/progress-lesson-count-label";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import {
  ProgressHeadline,
  ProgressHeadlineLabel,
  ProgressHeadlineValue,
} from "../_components/progress-headline";

/**
 * Leads Activity with the lifetime lesson total while supporting metrics remain
 * below the calendar in the same hierarchy as other progress pages.
 */
export async function ActivityStats({
  totalLessonCompletions,
}: {
  totalLessonCompletions: number;
}) {
  const t = await getExtracted();
  const lessonCountLabel = await getProgressLessonCountLabel({ count: totalLessonCompletions });

  return (
    <ProgressHeadline>
      <ProgressHeadlineLabel>{t("Lessons completed")}</ProgressHeadlineLabel>
      <ProgressHeadlineValue>{lessonCountLabel}</ProgressHeadlineValue>
    </ProgressHeadline>
  );
}

/** Mirrors the lifetime lesson headline while private progress data streams. */
export function ActivityStatsSkeleton() {
  return (
    <ProgressHeadline>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-12 w-48" />
    </ProgressHeadline>
  );
}
