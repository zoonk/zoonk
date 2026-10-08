import { POSTHOG_SYSTEM_DISTINCT_ID } from "@zoonk/utils/posthog";
import { type AiGeneration } from "./ai-generation-sink";

type EventPropertyValue = boolean | number | string;

/** Who a task ran for, so AI cost can be summed per learner, goal and content scope. */
export type AiGenerationContext = {
  /** The learner the call ran for. Omit it for system work that no learner triggered. */
  distinctId?: string;
  goalId?: string;
  /** Shared Library content or content made for one learner. Defaults to shared. */
  contentScope?: "personal" | "shared";
  /** Groups the calls of one larger job, such as a workflow run. Defaults to the task's run id. */
  traceId?: string;
};

export type AiGenerationEvent = {
  distinctId: string;
  event: "$ai_generation";
  properties: Record<string, EventPropertyValue>;
};

const MS_PER_SECOND = 1000;

/**
 * Maps a finished AI call to PostHog's `$ai_generation` event. It never carries prompt
 * or response text. A known cost is sent as a passthrough total so PostHog
 * keeps our price list's cost (at the tier that actually served the call)
 * instead of estimating one from its own price table; without one, PostHog estimates
 * from the model and token counts.
 */
export function toAiGenerationEvent({
  context = {},
  properties: extraProperties = {},
  provenance,
  task,
}: AiGeneration): AiGenerationEvent {
  const { costUsd, usage } = provenance;

  const properties: Record<string, EventPropertyValue | undefined> = {
    $ai_cache_creation_input_tokens: usage.cacheWriteTokens,
    $ai_cache_read_input_tokens: usage.cacheReadTokens,
    // AI SDK input token counts include cached tokens for every provider.
    $ai_cache_reporting_exclusive: false,
    $ai_cost_passthrough: costUsd === undefined ? undefined : true,
    $ai_input_tokens: usage.inputTokens,
    $ai_latency: provenance.latencyMs / MS_PER_SECOND,
    $ai_model: provenance.model,
    $ai_output_tokens: usage.outputTokens,
    $ai_provider: provenance.provider,
    $ai_reasoning_tokens: usage.reasoningTokens,
    $ai_span_id: provenance.runId,
    $ai_span_name: task,
    $ai_total_cost_usd: costUsd,
    $ai_trace_id: context.traceId ?? provenance.runId,
    $process_person_profile: context.distinctId ? undefined : false,
    content_scope: context.contentScope ?? "shared",
    goal_id: context.goalId,
    prompt_version: provenance.promptVersion,
    requested_model: provenance.requestedModel,
    service_tier: provenance.serviceTier,
    task,
    ...extraProperties,
  };

  return {
    distinctId: context.distinctId ?? POSTHOG_SYSTEM_DISTINCT_ID,
    event: "$ai_generation",
    properties: Object.fromEntries(
      Object.entries(properties).filter(
        (entry): entry is [string, EventPropertyValue] => entry[1] !== undefined,
      ),
    ),
  };
}
