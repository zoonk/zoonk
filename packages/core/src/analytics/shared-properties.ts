export type AnalyticsGoalKind = "exam" | "explain" | "language" | "learn";
export type AnalyticsPlatform = "android" | "ios" | "web";

/**
 * Carried by every event so retention, learning and conversion can be compared
 * by goal kind, locale and platform without joining other data. `null`
 * means the sender can't know the value, such as a learner without a goal yet
 * or a server event whose request came from no known client, like a webhook.
 */
export type SharedEventProperties = {
  goal_kind: AnalyticsGoalKind | null;
  is_guest: boolean;
  locale: string | null;
  plan_phase: number | null;
  platform: AnalyticsPlatform | null;
};

/**
 * Maps what the sender knows about the learner to the snake_case properties
 * PostHog stores.
 */
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
