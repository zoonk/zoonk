import { STATS_ANALYSIS_GROUPS, type StatsAnalysisPath } from "./stats-analysis-groups";

export type StatsAnalysisView = (typeof STATS_ANALYSIS_GROUPS)[number]["views"][number];

export type StatsAnalysisViewAt<Path extends StatsAnalysisPath> = Extract<
  StatsAnalysisView,
  { path: Path }
>;

export type ContentAnalysisView = StatsAnalysisViewAt<"/stats/content">;
export type EngagementAnalysisView = StatsAnalysisViewAt<"/stats/engagement">;
export type GrowthAnalysisView = StatsAnalysisViewAt<"/stats/growth">;
export type LearningAnalysisView = StatsAnalysisViewAt<"/stats/learning">;
export type OutcomesAnalysisView = StatsAnalysisViewAt<"/stats/outcomes">;

const DEFAULT_ANALYSIS_BY_PATH = {
  "/stats/content": "new-courses",
  "/stats/engagement": "active-learners",
  "/stats/growth": "new-signups",
  "/stats/learning": "daily-active-learners",
  "/stats/outcomes": "goals-reached",
} as const satisfies { [Path in StatsAnalysisPath]: StatsAnalysisViewAt<Path>["id"] };

/**
 * Keeps every analytics view in one shared navigation model so adding a stat
 * cannot silently make it unreachable from one of the stats routes. An unknown
 * or missing view falls back to the route's default analysis.
 */
export function getStatsAnalysisView<Path extends StatsAnalysisPath>({
  path,
  value,
}: {
  path: Path;
  value?: string | string[];
}): StatsAnalysisViewAt<Path> {
  const requestedId = Array.isArray(value) ? value[0] : value;
  const defaultId: string = DEFAULT_ANALYSIS_BY_PATH[path];

  const views = STATS_ANALYSIS_GROUPS.flatMap((group) => [...group.views]).filter(
    (view): view is StatsAnalysisViewAt<Path> => view.path === path,
  );

  const selectedView =
    views.find((view) => view.id === requestedId) ?? views.find((view) => view.id === defaultId);

  if (!selectedView) {
    throw new Error(`Stats route has no default analysis: ${path}`);
  }

  return selectedView;
}
