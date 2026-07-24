import { type ScorePerformance } from "@/data/progress/_utils/score-performance";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { formatMetricPercent, formatWholeNumber } from "@zoonk/utils/number";
import { getExtracted, getFormatter } from "next-intl/server";
import {
  ProgressHeadline,
  ProgressHeadlineLabel,
  ProgressHeadlineValue,
} from "../_components/progress-headline";

/**
 * Leads Score with one weighted 90-day accuracy and its denominator so learners
 * can judge the percentage with the answer volume that produced it.
 */
export async function ScoreStats({ performance }: { performance: ScorePerformance }) {
  const t = await getExtracted();
  const format = await getFormatter();
  const formattedScore = formatMetricPercent({ format, value: performance.score });
  const formattedCorrect = formatWholeNumber({ format, value: performance.correctAnswers });

  return (
    <ProgressHeadline aria-label={t("Score summary")} role="region">
      <ProgressHeadlineLabel>{t("Past 90 days")}</ProgressHeadlineLabel>
      <ProgressHeadlineValue className="text-score">{formattedScore}</ProgressHeadlineValue>
      <span className="text-muted-foreground text-sm tabular-nums">
        {t("{correct} of {total, plural, one {# answer} other {# answers}} correct", {
          correct: formattedCorrect,
          total: performance.totalAnswers,
        })}
      </span>
    </ProgressHeadline>
  );
}

/** Mirrors the fixed Score headline and denominator while private data streams. */
export function ScoreStatsSkeleton() {
  return (
    <ProgressHeadline aria-hidden="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-12 w-28" />
      <Skeleton className="h-4 w-44" />
    </ProgressHeadline>
  );
}
