export type AnalyticsGoalKind = "exam" | "explain" | "language" | "learn";
export type AnalyticsPlatform = "android" | "ios" | "web";

export type SharedEventProperties = {
  goal_kind: AnalyticsGoalKind | null;
  is_guest: boolean;
  locale: string | null;
  plan_phase: number | null;
  platform: AnalyticsPlatform | null;
};

export function buildSharedEventProperties({
  goal = null,
  isGuest,
  locale,
  platform,
}: {
  goal?: { kind: AnalyticsGoalKind; phase: number | null } | null;
  isGuest: boolean;
  locale: string | null;
  platform: AnalyticsPlatform | null;
}): SharedEventProperties {
  return {
    goal_kind: goal?.kind ?? null,
    is_guest: isGuest,
    locale,
    plan_phase: goal?.phase ?? null,
    platform,
  };
}
