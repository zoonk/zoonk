import "server-only";
import { toAiGenerationEvent } from "@zoonk/ai/ai-generation-event";
import { type AiGeneration, registerAiGenerationSink } from "@zoonk/ai/ai-generation-sink";
import { prisma } from "@zoonk/db";
import { getPostHogConfig } from "@zoonk/utils/posthog";
import { PostHog } from "posthog-node";

/**
 * A generation for a learner who turned usage data off, or whose account is gone, still counts its
 * cost, as system work that names neither them nor their goal.
 */
async function toLearnerAiGenerationEvent(generation: AiGeneration) {
  const userId = generation.context?.distinctId;

  if (!userId) {
    return toAiGenerationEvent(generation);
  }

  const user = await prisma.user.findUnique({
    select: { learningProfile: { select: { shareUsageData: true } } },
    where: { id: userId },
  });

  if (user && user.learningProfile?.shareUsageData !== false) {
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
