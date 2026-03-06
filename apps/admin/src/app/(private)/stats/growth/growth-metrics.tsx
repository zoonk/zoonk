import { countSubscribersByPlan } from "@/data/stats/count-subscribers-by-plan";
import { getActivationRate } from "@/data/stats/get-activation-rate";
import { getConversionRate } from "@/data/stats/get-conversion-rate";
import { getDailySignups } from "@/data/stats/get-daily-signups";
import { getNewSignups } from "@/data/stats/get-new-signups";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { buildChartData, calculateDateRanges, validatePeriod } from "@zoonk/utils/date-ranges";
import { validateOffset } from "@zoonk/utils/string";
import { CreditCardIcon, TargetIcon, UsersIcon } from "lucide-react";
import { AdminMetricCard, AdminMetricCardSkeleton } from "../_components/admin-metric-card";
import { AdminTrendChart } from "../_components/admin-trend-chart";
import { SubscribersTable } from "./subscribers-table";

export async function GrowthMetrics({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; offset?: string }>;
}) {
  const { period: rawPeriod, offset: rawOffset } = await searchParams;
  const period = validatePeriod(rawPeriod ?? "month");
  const offset = validateOffset(rawOffset);
  const { current, previous } = calculateDateRanges(period, offset);

  const [
    currentSignups,
    previousSignups,
    currentActivation,
    currentConversion,
    dailySignups,
    subscribers,
  ] = await Promise.all([
    getNewSignups(current.start, current.end),
    getNewSignups(previous.start, previous.end),
    getActivationRate(),
    getConversionRate(),
    getDailySignups(current.start, current.end),
    countSubscribersByPlan(),
  ]);

  const { average: chartAverage, dataPoints: chartData } = buildChartData(
    dailySignups,
    period,
    "en",
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        <AdminMetricCard
          change={{ current: currentSignups, period, previous: previousSignups }}
          help="New user registrations in this period"
          icon={<UsersIcon />}
          title="New Signups"
          value={currentSignups.toLocaleString()}
        />

        <AdminMetricCard
          description={`${currentActivation.activated.toLocaleString()} of ${currentActivation.total.toLocaleString()} users`}
          help="Users who completed at least 1 lesson"
          icon={<TargetIcon />}
          title="Activation Rate"
          value={`${currentActivation.rate.toFixed(1)}%`}
        />

        <AdminMetricCard
          description={`${currentConversion.paid.toLocaleString()} paid of ${currentConversion.total.toLocaleString()} total`}
          help="Active paid subscribers vs all users"
          icon={<CreditCardIcon />}
          title="Free-to-Paid"
          value={`${currentConversion.rate.toFixed(1)}%`}
        />
      </div>

      {chartData.length > 0 && (
        <AdminTrendChart average={chartAverage} dataPoints={chartData} valueLabel="signups" />
      )}

      {subscribers.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-semibold tracking-tight">Subscribers by Plan</h3>

          <div className="rounded-lg border">
            <SubscribersTable data={subscribers} />
          </div>
        </div>
      )}
    </div>
  );
}

export function GrowthMetricsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
