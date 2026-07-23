import { getBpHistory } from "@/data/progress/get-bp-history";
import { getSession } from "@/data/users/get-session";
import { validatePeriod } from "@zoonk/utils/date-ranges";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import { ProgressChartSkeleton } from "../_components/progress-chart-skeleton";
import { ProgressContent } from "../_components/progress-content";
import { ProgressEmptyState } from "../_components/progress-empty-state";
import { ProgressExplanationSkeleton } from "../_components/progress-explanation-skeleton";
import { LevelChart } from "./level-chart";
import { LevelExplanation } from "./level-explanation";
import { LevelInsights, LevelInsightsSkeleton } from "./level-insights";
import { LevelProgression, LevelProgressionSkeleton } from "./level-progression";
import { LevelStats, LevelStatsSkeleton } from "./level-stats";

export async function LevelContent({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string; period?: string }>;
}) {
  const { offset = "0", period = "month" } = await searchParams;
  const validPeriod = validatePeriod(period);
  const locale = await getLocale();

  const [data, session] = await Promise.all([
    getBpHistory({ locale, offset: Number(offset), period: validPeriod }),
    getSession(),
  ]);

  const isAuthenticated = Boolean(session);

  if (!(data && isAuthenticated)) {
    return (
      <ProgressEmptyState isAuthenticated={isAuthenticated}>
        <LevelExplanation />
      </ProgressEmptyState>
    );
  }

  return (
    <ProgressContent>
      <LevelStats
        currentBelt={data.currentBelt}
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        periodTotal={data.periodTotal}
        previousPeriodTotal={data.previousPeriodTotal}
        totalBp={data.totalBp}
      />

      <LevelChart
        dataPoints={data.dataPoints}
        hasNext={data.hasNextPeriod}
        hasPrevious={data.hasPreviousPeriod}
        period={validPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        periodTotal={data.periodTotal}
      />

      <Suspense fallback={<LevelInsightsSkeleton />}>
        <LevelInsights
          period={validPeriod}
          periodEnd={data.periodEnd}
          periodStart={data.periodStart}
        />
      </Suspense>

      <LevelProgression currentBelt={data.currentBelt} />

      <LevelExplanation />
    </ProgressContent>
  );
}

export function LevelContentSkeleton() {
  return (
    <ProgressContent>
      <LevelStatsSkeleton />
      <ProgressChartSkeleton />
      <LevelInsightsSkeleton />
      <LevelProgressionSkeleton />
      <ProgressExplanationSkeleton />
    </ProgressContent>
  );
}
