import { type StatsAnalysisViewAt, getStatsAnalysisView } from "../_utils/stats-analysis";
import { type StatsAnalysisPath } from "../_utils/stats-analysis-groups";
import { type StatsPeriod, buildStatsPeriodQuery, getStatsPeriod } from "../_utils/stats-period";
import { StatsExplorerLayout } from "./stats-explorer-layout";

type StatsSearchParams = Record<string, string | string[] | undefined>;

type StatsExplorerContext<Path extends StatsAnalysisPath> = {
  params: StatsSearchParams;
  periodQuery: string;
  selectedView: StatsAnalysisViewAt<Path>;
  statsPeriod: StatsPeriod;
};

/**
 * Every stats route resolves the same URL state (period and selected view) and renders the same
 * explorer chrome; routes only decide what the selected view shows.
 */
export async function StatsExplorerRoute<Path extends StatsAnalysisPath>({
  children,
  path,
  searchParams,
}: {
  children: (context: StatsExplorerContext<Path>) => React.ReactNode;
  path: Path;
  searchParams: Promise<StatsSearchParams>;
}) {
  const params = await searchParams;
  const statsPeriod = await getStatsPeriod(params);
  const selectedView = getStatsAnalysisView({ path, value: params.view });
  const periodQuery = buildStatsPeriodQuery(statsPeriod);

  return (
    <StatsExplorerLayout
      periodQuery={periodQuery}
      selectedView={selectedView}
      statsPeriod={statsPeriod}
    >
      {children({ params, periodQuery, selectedView, statsPeriod })}
    </StatsExplorerLayout>
  );
}
