import { getScoreHistory } from "@/data/progress/get-score-history";
import { getSession } from "@zoonk/core/users/session/get";
import { validatePeriod } from "@zoonk/utils/date-ranges";
import { getLocale } from "next-intl/server";
import { ProgressChartSkeleton } from "../_components/progress-chart-skeleton";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { ProgressExplanationSkeleton } from "../_components/progress-explanation-skeleton";
import { ScoreChart } from "./score-chart";
import { ScoreExplanation } from "./score-explanation";
import { ScoreInsights, ScoreInsightsSkeleton } from "./score-insights";
import { ScoreStats, ScoreStatsSkeleton } from "./score-stats";

export async function ScoreContent({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; period?: string }>;
}) {
  const { offset = "0", period = "month" } = await searchParams;
  const validPeriod = validatePeriod(period);
  const locale = await getLocale();

  const [data, session] = await Promise.all([
    getScoreHistory({ locale, offset: Number(offset), period: validPeriod }),
    getSession(),
  ]);

  const isAuthenticated = Boolean(session);

  if (!(data && isAuthenticated)) {
    return (
      <ProgressEmptyState isAuthenticated={isAuthenticated}>
        <ScoreExplanation />
      </ProgressEmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ScoreStats
        average={data.average}
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        previousAverage={data.previousAverage}
      />

      <ScoreChart
        average={data.average}
        dataPoints={data.dataPoints}
        hasNext={data.hasNextPeriod}
        hasPrevious={data.hasPreviousPeriod}
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
      />

      <ScoreInsights
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
      />

      <ScoreExplanation />
    </div>
  );
}

export function ScoreContentSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <ScoreStatsSkeleton />
      <ProgressChartSkeleton />
      <ScoreInsightsSkeleton />
      <ProgressExplanationSkeleton />
    </div>
  );
}
