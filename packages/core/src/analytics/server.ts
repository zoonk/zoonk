import "server-only";
import { getEnvironment } from "@zoonk/utils/environment";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
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
 * workflow step can stop right after its work ends. Analytics failures never fail the caller: the
 * error is returned, and only an `immediate` send waits for PostHog's answer, so it knows the event
 * arrived.
 */
async function capture({
  distinctId,
  event,
  immediate = false,
  properties,
}: {
  distinctId: string;
  event: AnalyticsEvent["name"];
  immediate?: boolean;
  properties: EventProperties;
}): Promise<Error | null> {
  const config = getPostHogConfig();

  if (!config) {
    return null;
  }

  const { error } = await safeAsync(async () => {
    const posthog = new PostHog(config.projectToken, {
      ...POSTHOG_LIMITS,
      flushAt: 1,
      flushInterval: 0,
      host: config.host,
    });

    try {
      if (immediate) {
        await posthog.captureImmediate({ distinctId, event, properties });
      } else {
        posthog.capture({ distinctId, event, properties });
      }
    } finally {
      await posthog.shutdown(SHUTDOWN_TIMEOUT_MS);
    }
  });

  return error;
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

/**
 * Marks an account that was just deleted, with nothing but its id, so its PostHog person can be
 * deleted too, with its events and recordings: a weekly manual step (the privacy policy says within
 * 15 days). Learners kept out of analytics send nothing, and neither do E2E runs. A failure is
 * logged with the id, for deleting that person by hand, and never stops the account's deletion.
 */
export async function trackAccountDeleted({
  analyticsDisabled,
  userId,
}: {
  analyticsDisabled: boolean;
  userId: string;
}): Promise<void> {
  if (analyticsDisabled || getEnvironment() === "e2e") {
    return;
  }

  const error = await capture({
    distinctId: userId,
    event: "Account Deleted",
    immediate: true,
    properties: {},
  });

  if (error) {
    logError("Account Deleted didn't reach PostHog; delete this person by hand:", userId, error);
  }
}
