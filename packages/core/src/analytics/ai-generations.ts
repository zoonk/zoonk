import "server-only";
import { toAiGenerationEvent } from "@zoonk/ai/ai-generation-event";
import { type AiGeneration, registerAiGenerationSink } from "@zoonk/ai/ai-generation-sink";
import { getPostHogConfig } from "@zoonk/utils/posthog";
import { PostHog } from "posthog-node";
import { loadLearnerAnalyticsPolicy } from "./learner-analytics-policy";

/**
 * Only an adult who shares usage data is named. Anyone else's generation still counts its cost, as
 * system work that names neither them nor their goal.
 */
async function toLearnerAiGenerationEvent(generation: AiGeneration) {
  const userId = generation.context?.distinctId;

  if (!userId) {
    return toAiGenerationEvent(generation);
  }

  const policy = await loadLearnerAnalyticsPolicy({ country: null, userId });

  if (policy === "identified") {
    return toAiGenerationEvent(generation);
  }

  const { contentScope, traceId } = generation.context ?? {};
  return toAiGenerationEvent({ ...generation, context: { contentScope, traceId } });
}

export function registerAiGenerationAnalytics() {
  registerAiGenerationSink("posthog", async (generation) => {
    const config = getPostHogConfig();

    if (!config) {
      return;
    }

    const { distinctId, event, properties } = await toLearnerAiGenerationEvent(generation);

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
