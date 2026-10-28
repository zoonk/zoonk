import { track } from "@vercel/analytics";
import { type AnalyticsEvent, type TrackOptions } from "./events";
import { loadPostHogForEvents } from "./posthog-browser";

/** Send outcomes through `trackServerEvent` so ad blockers cannot hide them. */
export function trackEvent({ name, properties }: AnalyticsEvent, options: TrackOptions = {}) {
  track(name, properties);

  void loadPostHogForEvents().then((posthog) =>
    posthog?.capture(name, properties, options.instant ? { send_instantly: true } : undefined),
  );
}
