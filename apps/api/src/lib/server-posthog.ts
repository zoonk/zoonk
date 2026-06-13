import "server-only";
import { getPostHogConfig } from "@zoonk/utils/posthog";
import { type EventMessage, PostHog } from "posthog-node";

type ServerPostHogClient = {
  capture: (props: EventMessage) => void;
  [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates a short-lived PostHog Node client for API server analytics so each
 * event helper can share one initialization path while still flushing before
 * the request finishes.
 */
export function createServerPostHogClient(): ServerPostHogClient | null {
  const postHogConfig = getPostHogConfig();

  if (!postHogConfig) {
    return null;
  }

  const posthog = new PostHog(postHogConfig.projectToken, {
    flushAt: 1,
    flushInterval: 0,
    host: postHogConfig.host,
  });

  return {
    async [Symbol.asyncDispose]() {
      await posthog.shutdown();
    },

    capture(props: EventMessage) {
      posthog.capture(props);
    },
  };
}
