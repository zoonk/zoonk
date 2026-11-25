import { track } from "@vercel/analytics";
import { type AnalyticsEvent, type TrackOptions } from "./events";
import { loadPostHogForEvents } from "./posthog-browser";

/** Send outcomes through `trackServerEvent` so ad blockers cannot hide them. */
export function trackEvent({ name, properties }: AnalyticsEvent, options: TrackOptions = {}) {
  track(name, properties);

  // PostHog may start later, on the visitor's first input, so the event keeps the time it happened.
  const timestamp = new Date();

  void loadPostHogForEvents().then((posthog) =>
    posthog?.capture(name, properties, { send_instantly: options.instant, timestamp }),
  );
}
