import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@zoonk/ui/components/breadcrumb";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import Link from "next/link";
import { type StatsAnalysisPath, type StatsAnalysisView } from "../_utils/stats-analysis";
import { type StatsPeriod } from "../_utils/stats-period";
import { StatsAnalysisPicker } from "./stats-analysis-picker";
import { StatsPeriodPicker } from "./stats-period-picker";

/**
 * The analytics explorer keeps permanent chrome to two decisions: what to
 * analyze and, only when relevant, when to analyze it. The selected result can
 * then use the rest of the viewport without competing cards or filter rows.
 */
export function StatsExplorerLayout({
  children,
  currentQuery,
  path,
  periodQuery,
  selectedView,
  statsPeriod,
}: {
  children: React.ReactNode;
  currentQuery: string;
  path: StatsAnalysisPath;
  periodQuery: string;
  selectedView: StatsAnalysisView;
  statsPeriod: StatsPeriod;
}) {
  return (
    <Container className="min-h-full gap-2">
      <ContainerHeader className="items-start" variant="sidebar">
        <ContainerHeaderGroup className="min-w-0 flex-1 gap-3">
          <StatsExplorerBreadcrumb />
          <StatsExplorerControls
            currentQuery={currentQuery}
            path={path}
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
 * The short breadcrumb grounds the unified explorer in the admin hierarchy
 * without repeating the selected category or analysis name.
 */
function StatsExplorerBreadcrumb() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/" prefetch />}>Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Stats</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * Mobile stacks the two meaningful decisions; wider layouts keep the analysis
 * on the left and its period on the right, mirroring the approved concept.
 */
function StatsExplorerControls({
  currentQuery,
  path,
  periodQuery,
  selectedView,
  statsPeriod,
}: {
  currentQuery: string;
  path: StatsAnalysisPath;
  periodQuery: string;
  selectedView: StatsAnalysisView;
  statsPeriod: StatsPeriod;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <ContainerTitle className="min-w-0 flex-1 text-2xl sm:text-3xl">
        <StatsAnalysisPicker periodQuery={periodQuery} selectedView={selectedView} />
      </ContainerTitle>

      {selectedView.usesPeriod ? (
        <StatsPeriodPicker currentQuery={currentQuery} path={path} statsPeriod={statsPeriod} />
      ) : null}
    </div>
  );
}

/**
 * The fallback mirrors the focused explorer rather than the old metric grid,
 * preventing the loading state from briefly reintroducing visual clutter.
 */
export function StatsExplorerSkeleton() {
  return (
    <div className="flex min-h-128 flex-col gap-8 py-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-40" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <Skeleton className="min-h-72 flex-1 rounded-xl" />
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
