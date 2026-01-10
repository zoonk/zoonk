import { getSession } from "@zoonk/core/users/session/get";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getExtracted } from "next-intl/server";
import type { EnergyPeriod } from "@/data/progress/get-energy-history";
import { getEnergyHistory } from "@/data/progress/get-energy-history";
import { Link } from "@/i18n/navigation";
import { EnergyChart, EnergyChartSkeleton } from "./energy-chart";
import { EnergyExplanation } from "./energy-explanation";
import { EnergyStats, EnergyStatsSkeleton } from "./energy-stats";

export async function EnergyContent({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: Promise<{ offset?: string; period?: string }>;
}) {
  const { offset = "0", period = "month" } = await searchParams;
  const t = await getExtracted();

  const [data, session] = await Promise.all([
    getEnergyHistory({
      locale,
      offset: Number(offset),
      period: period as EnergyPeriod,
    }),
    getSession(),
  ]);

  const isAuthenticated = Boolean(session);

  if (!(data && isAuthenticated)) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-4 text-muted-foreground">
          {isAuthenticated ? (
            t("Start learning to track your energy level")
          ) : (
            <>
              <span>{t("Log in to track your energy level")}</span>
              <Link className={buttonVariants()} href="/login" prefetch={false}>
                {t("Login")}
              </Link>
            </>
          )}
        </div>

        <EnergyExplanation />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <EnergyStats
        average={data.average}
        period={period as EnergyPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
        previousAverage={data.previousAverage}
      />

      <EnergyChart
        average={data.average}
        dataPoints={data.dataPoints}
        hasNext={data.hasNextPeriod}
        hasPrevious={data.hasPreviousPeriod}
        period={period as EnergyPeriod}
        periodEnd={data.periodEnd}
        periodStart={data.periodStart}
      />

      <EnergyExplanation />
    </div>
  );
}

export function EnergyContentSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <EnergyStatsSkeleton />
      <EnergyChartSkeleton />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}
