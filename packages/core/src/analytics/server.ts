import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import {
  POSTHOG_SHUTDOWN_TIMEOUT_MS,
  POSTHOG_SYSTEM_DISTINCT_ID,
  getPostHogConfig,
} from "@zoonk/utils/posthog";
import { type EventOptions, PostHog } from "posthog-node";
import { type ServerAnalyticsEvent } from "./events";
import { type SharedEventProperties } from "./shared-properties";

const POSTHOG_LIMITS = { fetchRetryCount: 1, requestTimeout: 2000 };

type EventProperties = Record<string, boolean | number | string | string[] | null | undefined>;

/** Flush before returning because the function or workflow step can stop as soon as it returns. */
async function capture({
  distinctId,
  event,
  options,
  properties,
}: {
  distinctId: string;
  event: ServerAnalyticsEvent["name"];
  options?: EventOptions;
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
      posthog.capture({ distinctId, event, ...(options && { options }), properties });
    } finally {
      await posthog.shutdown(POSTHOG_SHUTDOWN_TIMEOUT_MS);
    }
  });
}

export async function trackServerEvent({
  distinctId,
  name,
  properties,
  shared,
}: ServerAnalyticsEvent & { distinctId: string; shared: SharedEventProperties }): Promise<void> {
  await capture({ distinctId, event: name, properties: { ...properties, ...shared } });
}

export async function trackSystemEvent({ name, properties }: ServerAnalyticsEvent): Promise<void> {
  await capture({
    distinctId: POSTHOG_SYSTEM_DISTINCT_ID,
    event: name,
    options: { process_person_profile: false },
    properties: properties ?? {},
  });
}
