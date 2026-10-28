import "server-only";
import { computeCallCostUsd } from "../../../pricing/call-cost";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { captureAiGeneration } from "../../../provenance/ai-generation-sink";
import { LIVE_CONVERSATION_PROMPT_VERSION } from "./live-conversation-instructions";
import { LIVE_CONVERSATION_MODEL } from "./live-conversation-models";

/**
 * GPT-Live bills the session per second, silence included; core supplies the settled seconds,
 * initialization floor included.
 */
export async function recordLiveConversationUsage({
  analytics,
  runId,
  seconds,
}: {
  analytics?: AiGenerationContext;
  runId: string;
  seconds: number;
}): Promise<void> {
  const usage = { audioSeconds: seconds };

  await captureAiGeneration({
    context: analytics,
    provenance: {
      costUsd: computeCallCostUsd({ model: LIVE_CONVERSATION_MODEL, usage }),
      generatedAt: new Date().toISOString(),
      latencyMs: 0,
      model: LIVE_CONVERSATION_MODEL,
      promptVersion: LIVE_CONVERSATION_PROMPT_VERSION,
      provider: "openai",
      requestedModel: LIVE_CONVERSATION_MODEL,
      runId,
      usage,
    },
    task: "live-conversation",
  });
}
