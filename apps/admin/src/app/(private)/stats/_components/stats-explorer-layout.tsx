import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type StatsAnalysisView } from "../_utils/stats-analysis";
import { type StatsPeriod } from "../_utils/stats-period";
import { StatsAnalysisPicker } from "./stats-analysis-picker";
import { StatsBreadcrumb } from "./stats-breadcrumb";
import { StatsPeriodPicker } from "./stats-period-picker";

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
      <ContainerHeader className="items-start" variant="sidebar">
        <ContainerHeaderGroup className="min-w-0 flex-1 gap-3">
          <StatsBreadcrumb />
          <StatsExplorerControls
            periodQuery={periodQuery}
            selectedView={selectedView}
            statsPeriod={statsPeriod}
          />
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="min-h-0 flex-1 pt-2 sm:pb-6">{children}</ContainerBody>
    </Container>
  );
}

function StatsExplorerControls({
  periodQuery,
  selectedView,
  statsPeriod,
}: {
  periodQuery: string;
  selectedView: StatsAnalysisView;
  statsPeriod: StatsPeriod;
}) {
  const currentQuery = getCurrentStatsQuery({ periodQuery, selectedView });

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <ContainerTitle className="min-w-0 flex-1 text-2xl sm:text-3xl">
        <StatsAnalysisPicker periodQuery={periodQuery} selectedView={selectedView} />
      </ContainerTitle>

      {selectedView.usesPeriod ? (
        <StatsPeriodPicker
          currentQuery={currentQuery}
          path={selectedView.path}
          statsPeriod={statsPeriod}
        />
      ) : null}
    </div>
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
      <ContainerHeader className="items-start" variant="sidebar">
        <ContainerHeaderGroup className="w-full gap-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Skeleton className="h-9 w-56 max-w-full" />
            <Skeleton className="h-9 w-40 max-w-full" />
          </div>
        </ContainerHeaderGroup>
      </ContainerHeader>
      <ContainerBody className="pt-2">
        <StatsExplorerSkeleton />
      </ContainerBody>
    </Container>
  );
}
