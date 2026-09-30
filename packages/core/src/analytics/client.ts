import { track } from "@vercel/analytics";
import { type AnalyticsEvent, type TrackOptions } from "./events";
import { loadPostHog } from "./posthog-browser";

/**
 * Sends an interface event (a view or a tap) from the browser. Outcomes go
 * through `trackServerEvent` instead, so ad blockers can't hide them. Shared
 * properties come from `RegisterSharedEventProperties`; a screen that knows
 * its mode passes it, which wins over the registered one. PostHog loads after
 * the page does (`loadPostHog`), so events sent before that wait for it.
 */
export function trackEvent({ name, properties }: AnalyticsEvent, options: TrackOptions = {}) {
  track(name, properties);

  void loadPostHog().then((posthog) =>
    posthog?.capture(
      name,
      options.mode ? { ...properties, mode: options.mode } : properties,
      options.instant ? { send_instantly: true } : undefined,
    ),
  );
}
