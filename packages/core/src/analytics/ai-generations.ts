import "server-only";
import { registerAiGenerationSink } from "@zoonk/ai/ai-generation-sink";
import { getPostHogConfig } from "@zoonk/utils/posthog";
import { PostHog } from "posthog-node";

/**
 * Sends the `$ai_generation` event of every `@zoonk/ai` task to PostHog's LLM
 * analytics. Apps call this from `instrumentation.ts`, so tasks in routes and
 * workflow steps report model, tokens, cost and latency without `@zoonk/ai`
 * depending on PostHog. Like `trackServerEvent`, each event uses a short-lived
 * client that flushes before returning, and nothing is sent without PostHog
 * settings.
 */
export function registerAiGenerationAnalytics() {
  registerAiGenerationSink(async ({ distinctId, event, properties }) => {
    const config = getPostHogConfig();

    if (!config) {
      return;
    }

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
