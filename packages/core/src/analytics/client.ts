import { track } from "@vercel/analytics";
import { type AnalyticsEvent, type TrackOptions } from "./events";
import { loadPostHogForEvents } from "./posthog-browser";

/**
 * Sends an interface event (a view or a tap) from the browser. Outcomes go
 * through `trackServerEvent` instead, so ad blockers can't hide them. Shared
 * properties come from `RegisterSharedEventProperties`. PostHog loads after
 * the page does (`loadPostHog`), so events sent before that wait for it, and
 * for the shared properties (`waitForSharedProperties`).
 */
export function trackEvent({ name, properties }: AnalyticsEvent, options: TrackOptions = {}) {
  track(name, properties);

  void loadPostHogForEvents().then((posthog) =>
    posthog?.capture(name, properties, options.instant ? { send_instantly: true } : undefined),
  );
}
