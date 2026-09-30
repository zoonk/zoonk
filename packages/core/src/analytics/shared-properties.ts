export type AnalyticsMode = "focus" | "fun";
export type AnalyticsGoalKind = "exam" | "explain" | "language" | "learn";
export type AnalyticsPlatform = "android" | "ios" | "web";

/**
 * Carried by every event so retention, learning and conversion can be compared
 * by mode, goal kind, locale and platform without joining other data. `null`
 * means the sender can't know the value, such as a learner without a goal yet
 * or a server event whose request came from no known client, like a webhook.
 */
export type SharedEventProperties = {
  goal_kind: AnalyticsGoalKind | null;
  is_guest: boolean;
  locale: string | null;
  mode: AnalyticsMode;
  plan_phase: number | null;
  platform: AnalyticsPlatform | null;
};

/**
 * Maps what the sender knows about the learner to the snake_case properties
 * PostHog stores. Learners who never chose a mode are in Focus, the default.
 */
export function buildSharedEventProperties({
  goal = null,
  isGuest,
  locale,
  mode = "focus",
  platform,
}: {
  goal?: { kind: AnalyticsGoalKind; phase: number | null } | null;
  isGuest: boolean;
  locale: string | null;
  mode?: AnalyticsMode;
  platform: AnalyticsPlatform | null;
}): SharedEventProperties {
  return {
    goal_kind: goal?.kind ?? null,
    is_guest: isGuest,
    locale,
    mode,
    plan_phase: goal?.phase ?? null,
    platform,
  };
}
