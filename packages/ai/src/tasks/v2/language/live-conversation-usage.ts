import "server-only";
import {
  type AiGenerationContext,
  toAiGenerationEvent,
} from "../../../provenance/ai-generation-event";
import { captureAiGeneration } from "../../../provenance/ai-generation-sink";
import { LIVE_CONVERSATION_PROMPT_VERSION } from "./live-conversation-instructions";
import { LIVE_CONVERSATION_MODEL } from "./live-conversation-models";

/** GPT-Live bills the session per second, silence included, at $0.05 a minute. */
const PRICE_PER_MINUTE_USD = 0.05;
const SECONDS_PER_MINUTE = 60;

/**
 * Records a finished call's voice session as an AI generation, so its cost sits next to every
 * other model call's. The browser talks to GPT-Live directly, so the session length is the one
 * GPT-Live reported to it when the call closed.
 */
export async function recordLiveConversationUsage({
  analytics,
  runId,
  seconds,
}: {
  analytics?: AiGenerationContext;
  /** The conversation's id, so the call's feedback and checks can be traced with it. */
  runId: string;
  seconds: number;
}): Promise<void> {
  await captureAiGeneration(
    toAiGenerationEvent({
      context: analytics,
      provenance: {
        costUsd: (seconds / SECONDS_PER_MINUTE) * PRICE_PER_MINUTE_USD,
        generatedAt: new Date().toISOString(),
        latencyMs: 0,
        model: LIVE_CONVERSATION_MODEL,
        promptVersion: LIVE_CONVERSATION_PROMPT_VERSION,
        provider: "openai",
        requestedModel: LIVE_CONVERSATION_MODEL,
        runId,
        usage: {},
      },
      task: "live-conversation",
    }),
  );
}
