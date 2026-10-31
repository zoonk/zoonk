import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { POSTHOG_SYSTEM_DISTINCT_ID, getPostHogConfig } from "@zoonk/utils/posthog";
import { PostHog } from "posthog-node";
import { type AnalyticsEvent } from "./events";
import { type SharedEventProperties } from "./shared-properties";

const POSTHOG_LIMITS = { fetchRetryCount: 1, fetchRetryDelay: 500, requestTimeout: 2000 };
const SHUTDOWN_TIMEOUT_MS = 5000;

type EventProperties = Record<string, boolean | number | string | null | undefined>;

/** Flush before returning because the function or workflow step can stop as soon as it returns. */
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

export async function trackServerEvent({
  distinctId,
  name,
  properties,
  shared,
}: AnalyticsEvent & { distinctId: string; shared: SharedEventProperties }): Promise<void> {
  await capture({ distinctId, event: name, properties: { ...properties, ...shared } });
}

export async function trackSystemEvent({ name, properties }: AnalyticsEvent): Promise<void> {
  await capture({
    distinctId: POSTHOG_SYSTEM_DISTINCT_ID,
    event: name,
    properties: { ...properties, $process_person_profile: false },
  });
}
