import { type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { formatMetricPercent, formatWholeNumber } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import { ProgressHeadline, ProgressHeadlineValue } from "../_components/progress-headline";

/**
 * Leads Score with one weighted accuracy and the answers behind it, so learners can judge the
 * percentage with the answer volume that produced it. The 90-day window is said here, once.
 */
export async function ScoreStats({ performance }: { performance: ScorePerformance }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const formattedScore = formatMetricPercent({ format, value: performance.score });
  const formattedCorrect = formatWholeNumber({ format, value: performance.correctAnswers });

  return (
    <ProgressHeadline aria-label={t("Score summary")} role="region">
      <ProgressHeadlineValue className="text-score">{formattedScore}</ProgressHeadlineValue>
      <span className="text-muted-foreground text-sm tabular-nums">
        {t(
          "{correct} of {total, plural, one {# answer} other {# answers}} right in the last 90 days",
          { correct: formattedCorrect, total: performance.totalAnswers },
        )}
      </span>
    </ProgressHeadline>
  );
}

/** One sentence under the trend: every answer counts the same. */
export async function ScoreLine() {
  const t = await getExtracted();

  return (
    <p className="text-muted-foreground text-sm">
      {t("Every answer counts the same, so harder lessons can lower your score for a while.")}
    </p>
  );
}

/** Mirrors the Score headline and its answers while private data streams. */
export function ScoreStatsSkeleton() {
  return (
    <ProgressHeadline aria-hidden="true">
      <Skeleton className="h-12 w-28" />
      <Skeleton className="h-4 w-44" />
    </ProgressHeadline>
  );
}
