export type StatsAnalysisPath =
  | "/stats/content"
  | "/stats/engagement"
  | "/stats/growth"
  | "/stats/learning"
  | "/stats/outcomes";

type StatsAnalysisDefinition = {
  id: string;
  label: string;
  path: StatsAnalysisPath;
  usesPeriod: boolean;
};

/**
 * Every analysis in the explorer, grouped as the picker shows them. Adding a view here makes it
 * reachable from every stats route.
 */
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
    label: "Learning",
    views: [
      {
        id: "daily-active-learners",
        label: "Daily active learners",
        path: "/stats/learning",
        usesPeriod: true,
      },
      {
        id: "weekly-active-learners",
        label: "Weekly active learners",
        path: "/stats/learning",
        usesPeriod: true,
      },
      {
        id: "sessions-finished",
        label: "Sessions finished",
        path: "/stats/learning",
        usesPeriod: true,
      },
      {
        id: "minutes-vs-goal",
        label: "Minutes vs goal",
        path: "/stats/learning",
        usesPeriod: true,
      },
      { id: "retention", label: "Retention", path: "/stats/learning", usesPeriod: true },
      { id: "mastery-growth", label: "Mastery growth", path: "/stats/learning", usesPeriod: true },
    ],
  },
  {
    label: "Outcomes",
    views: [
      { id: "goals-reached", label: "Goals reached", path: "/stats/outcomes", usesPeriod: true },
      { id: "mock-exams", label: "Mock exams", path: "/stats/outcomes", usesPeriod: true },
      {
        id: "checkpoints-passed",
        label: "Checkpoints passed",
        path: "/stats/outcomes",
        usesPeriod: true,
      },
      {
        id: "exam-results",
        label: "Official exam results",
        path: "/stats/outcomes",
        usesPeriod: false,
      },
    ],
  },
  {
    label: "Content",
    views: [
      { id: "new-courses", label: "New courses", path: "/stats/content", usesPeriod: true },
      { id: "new-lessons", label: "New lessons", path: "/stats/content", usesPeriod: true },
      { id: "new-skills", label: "New skills", path: "/stats/content", usesPeriod: true },
      { id: "new-items", label: "New items", path: "/stats/content", usesPeriod: true },
      { id: "new-media", label: "New images and audio", path: "/stats/content", usesPeriod: true },
      {
        id: "content-creation",
        label: "Content creation trend",
        path: "/stats/content",
        usesPeriod: true,
      },
      { id: "content-totals", label: "Content totals", path: "/stats/content", usesPeriod: true },
    ],
  },
] as const satisfies readonly { label: string; views: readonly StatsAnalysisDefinition[] }[];
