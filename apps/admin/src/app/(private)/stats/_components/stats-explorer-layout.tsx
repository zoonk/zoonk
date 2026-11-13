import { AdminHeader } from "@/components/admin-header";
import { Container, ContainerBody } from "@zoonk/ui/components/container";
import { PageTitle } from "@zoonk/ui/components/page-top";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type StatsAnalysisView } from "../_utils/stats-analysis";
import { type StatsPeriod } from "../_utils/stats-period";
import { StatsAnalysisPicker } from "./stats-analysis-picker";
import { StatsPeriodPicker } from "./stats-period-picker";

const STATS = { href: "/stats", label: "Stats" };

export function StatsExplorerLayout({
  children,
  periodQuery,
  selectedView,
  statsPeriod,
}: {
  children: React.ReactNode;
  periodQuery: string;
  selectedView: StatsAnalysisView;
  statsPeriod: StatsPeriod;
}) {
  return (
    <Container className="min-h-full gap-2">
      <AdminHeader
        actions={
          selectedView.usesPeriod ? (
            <StatsPeriodPicker
              currentQuery={getCurrentStatsQuery({ periodQuery, selectedView })}
              path={selectedView.path}
              statsPeriod={statsPeriod}
            />
          ) : null
        }
        parent={STATS}
        title={
          <PageTitle>
            <StatsAnalysisPicker periodQuery={periodQuery} selectedView={selectedView} />
          </PageTitle>
        }
      />

      <ContainerBody className="min-h-0 flex-1 pt-2 sm:pb-6">{children}</ContainerBody>
    </Container>
  );
}

function getCurrentStatsQuery({
  periodQuery,
  selectedView,
}: {
  periodQuery: string;
  selectedView: StatsAnalysisView;
}): string {
  const searchParams = new URLSearchParams(periodQuery);
  searchParams.set("view", selectedView.id);
  return searchParams.toString();
}

export function StatsExplorerSkeleton() {
  return (
    <div className="flex min-h-128 flex-col gap-8 py-4">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-5 pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

/** The URL-backed controls can't resolve in the static shell, so this reserves their layout. */
export function StatsExplorerPageSkeleton() {
  return (
    <Container className="min-h-full gap-2">
      <AdminHeader
        actions={<Skeleton className="h-7.5 w-24 rounded-md" />}
        parent={STATS}
        title={
          <span aria-hidden="true" className="text-title flex h-lh items-center">
            <Skeleton className="h-7 w-56 max-w-full" />
          </span>
        }
      />
      <ContainerBody className="pt-2">
        <StatsExplorerSkeleton />
      </ContainerBody>
    </Container>
  );
}
