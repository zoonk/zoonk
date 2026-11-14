import { AdminPage, AdminPageBody, AdminPageHeader, AdminToolbar } from "@/components/admin-page";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { Suspense } from "react";
import { BrainPowerLeaderboard, BrainPowerLeaderboardSkeleton } from "./brain-power-leaderboard";
import { parseLeaderboardPeriod } from "./leaderboard-period";
import { LeaderboardPeriodFilter } from "./leaderboard-period-filter";

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <AdminPage>
      <AdminPageHeader title="Leaderboard" />

      <AdminPageBody>
        <AdminToolbar className="justify-between">
          <Suspense fallback={<Skeleton className="h-7.5 w-52 rounded-md" />}>
            <LeaderboardFilters searchParams={searchParams} />
          </Suspense>
          <span className="text-muted-foreground text-compact">Brain Power earned</span>
        </AdminToolbar>

        <Suspense fallback={<BrainPowerLeaderboardSkeleton />}>
          <BrainPowerLeaderboard searchParams={searchParams} />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}

async function LeaderboardFilters({
  searchParams,
}: Pick<PageProps<"/leaderboard">, "searchParams">) {
  const params = await searchParams;
  const period = parseLeaderboardPeriod(params.period);

  return <LeaderboardPeriodFilter period={period} />;
}
