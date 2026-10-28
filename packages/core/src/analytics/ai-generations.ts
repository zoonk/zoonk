import "server-only";
import { toAiGenerationEvent } from "@zoonk/ai/ai-generation-event";
import { registerAiGenerationSink } from "@zoonk/ai/ai-generation-sink";
import { getPostHogConfig } from "@zoonk/utils/posthog";
import { PostHog } from "posthog-node";

export function registerAiGenerationAnalytics() {
  registerAiGenerationSink("posthog", async (generation) => {
    const config = getPostHogConfig();

    if (!config) {
      return;
    }

    const { distinctId, event, properties } = toAiGenerationEvent(generation);

    const posthog = new PostHog(config.projectToken, {
      flushAt: 1,
      flushInterval: 0,
      host: config.host,
    });

    try {
      posthog.capture({ distinctId, event, properties });
    } finally {
      await posthog.shutdown();
    }
  });
}
