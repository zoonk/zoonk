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

/**
 * The analytics explorer keeps permanent chrome to two decisions: what to
 * analyze and, only when relevant, when to analyze it. The selected result can
 * then use the rest of the viewport without competing cards or filter rows.
 */
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

/**
 * Mobile stacks the two meaningful decisions; wider layouts keep the analysis
 * on the left and its period on the right, mirroring the approved concept.
 */
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

/**
 * The selected view is part of the period picker's current URL state. Deriving
 * it beside the controls prevents route pages from passing a path or query that
 * disagrees with the selected analysis.
 */
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

/**
 * The fallback stays deliberately neutral because the selected analysis may
 * resolve to a chart, table, or threshold tool. Quiet text lines reserve space
 * without previewing the wrong visualization.
 */
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

/**
 * URL-backed analysis and period controls cannot resolve in the static shell,
 * so the route-level fallback reserves their complete layout until search
 * parameters are available behind Suspense.
 */
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
