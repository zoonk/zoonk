export type StatsAnalysisPath = "/stats/content" | "/stats/engagement" | "/stats/growth";

type StatsAnalysisBase = { label: string; usesPeriod: boolean };

export type GrowthAnalysisView = StatsAnalysisBase & {
  id: "activation-rate" | "free-to-paid" | "new-signups" | "subscribers-by-plan";
  path: "/stats/growth";
};

export type EngagementAnalysisView = StatsAnalysisBase & {
  id:
    | "accuracy-rate"
    | "active-learners"
    | "avg-lesson-time"
    | "completion-rate"
    | "learner-milestones"
    | "lesson-time-breakdown"
    | "total-learning-time";
  path: "/stats/engagement";
};

export type ContentAnalysisView = StatsAnalysisBase & {
  id:
    | "completed-lessons-by-kind"
    | "content-creation"
    | "content-totals"
    | "new-courses"
    | "new-lessons";
  path: "/stats/content";
};

export type StatsAnalysisView = ContentAnalysisView | EngagementAnalysisView | GrowthAnalysisView;
type StatsAnalysisId = StatsAnalysisView["id"];

export const STATS_ANALYSIS_GROUPS = [
  {
    label: "Growth",
    views: [
      { id: "new-signups", label: "New signups", path: "/stats/growth", usesPeriod: true },
      { id: "activation-rate", label: "Activation rate", path: "/stats/growth", usesPeriod: true },
      { id: "free-to-paid", label: "Free-to-paid", path: "/stats/growth", usesPeriod: true },
      {
        id: "subscribers-by-plan",
        label: "Subscribers by plan",
        path: "/stats/growth",
        usesPeriod: false,
      },
    ],
  },
  {
    label: "Engagement",
    views: [
      {
        id: "active-learners",
        label: "Active learners",
        path: "/stats/engagement",
        usesPeriod: true,
      },
      { id: "accuracy-rate", label: "Accuracy rate", path: "/stats/engagement", usesPeriod: true },
      {
        id: "completion-rate",
        label: "Completion rate",
        path: "/stats/engagement",
        usesPeriod: true,
      },
      {
        id: "avg-lesson-time",
        label: "Avg time / lesson",
        path: "/stats/engagement",
        usesPeriod: true,
      },
      {
        id: "total-learning-time",
        label: "Total learning time",
        path: "/stats/engagement",
        usesPeriod: true,
      },
      {
        id: "lesson-time-breakdown",
        label: "Lesson time breakdown",
        path: "/stats/engagement",
        usesPeriod: true,
      },
      {
        id: "learner-milestones",
        label: "Learner milestones",
        path: "/stats/engagement",
        usesPeriod: false,
      },
    ],
  },
  {
    label: "Content",
    views: [
      { id: "new-courses", label: "New courses", path: "/stats/content", usesPeriod: true },
      { id: "new-lessons", label: "New lessons", path: "/stats/content", usesPeriod: true },
      {
        id: "content-creation",
        label: "Content creation trend",
        path: "/stats/content",
        usesPeriod: true,
      },
      { id: "content-totals", label: "Content totals", path: "/stats/content", usesPeriod: true },
      {
        id: "completed-lessons-by-kind",
        label: "Completed lessons by kind",
        path: "/stats/content",
        usesPeriod: false,
      },
    ],
  },
] as const satisfies readonly { label: string; views: readonly StatsAnalysisView[] }[];

const DEFAULT_ANALYSIS_BY_PATH = {
  "/stats/content": "new-courses",
  "/stats/engagement": "active-learners",
  "/stats/growth": "new-signups",
} as const satisfies Record<StatsAnalysisPath, StatsAnalysisId>;

/**
 * Keeps every analytics view in one shared navigation model so adding a stat
 * cannot silently make it unreachable from one of the three stats routes.
 */
export function getStatsAnalysisView(input: {
  path: "/stats/growth";
  value?: string | string[];
}): GrowthAnalysisView;
export function getStatsAnalysisView(input: {
  path: "/stats/engagement";
  value?: string | string[];
}): EngagementAnalysisView;
export function getStatsAnalysisView(input: {
  path: "/stats/content";
  value?: string | string[];
}): ContentAnalysisView;
export function getStatsAnalysisView({
  path,
  value,
}: {
  path: StatsAnalysisPath;
  value?: string | string[];
}): StatsAnalysisView {
  const requestedView = Array.isArray(value) ? value[0] : value;
  const views = getAllStatsAnalysisViews();
  const matchingView = views.find((view) => view.path === path && view.id === requestedView);

  return matchingView ?? getStatsAnalysisViewById(DEFAULT_ANALYSIS_BY_PATH[path]);
}

/**
 * Resolves a known analysis identifier to its complete navigation metadata so
 * picker rendering and route-specific data loading share one source of truth.
 */
function getStatsAnalysisViewById(id: StatsAnalysisId): StatsAnalysisView {
  const views = getAllStatsAnalysisViews();
  const matchingView = views.find((view) => view.id === id);

  if (!matchingView) {
    throw new Error(`Unknown stats analysis view: ${id}`);
  }

  return matchingView;
}

/**
 * Normalizes the differently sized readonly view tuples into one shared list
 * for lookup without weakening each individual view's discriminated type.
 */
function getAllStatsAnalysisViews(): StatsAnalysisView[] {
  return STATS_ANALYSIS_GROUPS.flatMap((group) => [...group.views]);
}
