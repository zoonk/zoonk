import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { POSTHOG_SYSTEM_DISTINCT_ID, getPostHogConfig } from "@zoonk/utils/posthog";
import { PostHog } from "posthog-node";
import { type AnalyticsEvent } from "./events";
import { type SharedEventProperties } from "./shared-properties";

/**
 * Some senders await the event inside a learner's request, so a PostHog outage
 * may hold it for about 5 seconds at most (a 2-second request, one retry after
 * half a second, and a cap on the final flush) instead of the SDK's defaults
 * (10-second requests, three retries 3 seconds apart).
 */
const POSTHOG_LIMITS = { fetchRetryCount: 1, fetchRetryDelay: 500, requestTimeout: 2000 };
const SHUTDOWN_TIMEOUT_MS = 5000;

type EventProperties = Record<string, boolean | number | string | null | undefined>;

/**
 * Each call uses a short-lived client that flushes before returning, because a function or
 * workflow step can stop right after its work ends. Analytics failures never fail the caller.
 */
async function capture({
  distinctId,
  event,
  properties,
}: {
  distinctId: string;
  event: AnalyticsEvent["name"];
  properties: EventProperties;
}): Promise<void> {
  const config = getPostHogConfig();

  if (!config) {
    return;
  }

  await safeAsync(async () => {
    const posthog = new PostHog(config.projectToken, {
      ...POSTHOG_LIMITS,
      flushAt: 1,
      flushInterval: 0,
      host: config.host,
    });

    try {
      posthog.capture({ distinctId, event, properties });
    } finally {
      await posthog.shutdown(SHUTDOWN_TIMEOUT_MS);
    }
  });
}

/** Sends a learner's outcome from the server, where ad blockers can't hide it. */
export async function trackServerEvent({
  distinctId,
  name,
  properties,
  shared,
}: AnalyticsEvent & { distinctId: string; shared: SharedEventProperties }): Promise<void> {
  await capture({ distinctId, event: name, properties: { ...properties, ...shared } });
}

/**
 * Sends an outcome of work no learner started, such as a sweep, under the system's id
 * without creating a person profile. It has no learner, so it carries no shared properties.
 */
export async function trackSystemEvent({ name, properties }: AnalyticsEvent): Promise<void> {
  await capture({
    distinctId: POSTHOG_SYSTEM_DISTINCT_ID,
    event: name,
    properties: { ...properties, $process_person_profile: false },
  });
}
