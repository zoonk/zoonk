import { describe, expect, it } from "vitest";
import { toAiGenerationEvent } from "./ai-generation-event";
import { type TaskProvenance } from "./task-provenance";

const provenance: TaskProvenance = {
  costUsd: 0.0125,
  generatedAt: "2026-09-26T12:00:00.000Z",
  latencyMs: 2350,
  model: "anthropic/claude-opus-5.5",
  promptVersion: "3f9a1c2b7d4e",
  provider: "anthropic",
  requestedModel: "openai/gpt-6-sol",
  runId: "run-1",
  usage: {
    cacheReadTokens: 300,
    cacheWriteTokens: undefined,
    inputTokens: 1000,
    outputTokens: 400,
    reasoningTokens: 150,
    totalTokens: 1400,
  },
};

describe(toAiGenerationEvent, () => {
  it("attributes a learner's generation to the learner, goal and scope", () => {
    const event = toAiGenerationEvent({
      context: {
        contentScope: "personal",
        distinctId: "user-1",
        goalId: "goal-1",
        traceId: "workflow-run-1",
      },
      provenance,
      task: "lesson-explanation",
    });

    expect(event).toStrictEqual({
      distinctId: "user-1",
      event: "$ai_generation",
      properties: {
        $ai_cache_read_input_tokens: 300,
        $ai_cache_reporting_exclusive: false,
        $ai_cost_passthrough: true,
        $ai_input_tokens: 1000,
        $ai_latency: 2.35,
        $ai_model: "anthropic/claude-opus-5.5",
        $ai_output_tokens: 400,
        $ai_provider: "anthropic",
        $ai_reasoning_tokens: 150,
        $ai_span_id: "run-1",
        $ai_span_name: "lesson-explanation",
        $ai_total_cost_usd: 0.0125,
        $ai_trace_id: "workflow-run-1",
        content_scope: "personal",
        goal_id: "goal-1",
        prompt_version: "3f9a1c2b7d4e",
        requested_model: "openai/gpt-6-sol",
        task: "lesson-explanation",
      },
    });
  });

  it("sends system work as shared content without a person profile", () => {
    const { distinctId, properties } = toAiGenerationEvent({ provenance, task: "course-chapters" });

    expect(distinctId).toBe("zoonk-system");

    expect(properties).toMatchObject({
      $ai_trace_id: "run-1",
      $process_person_profile: false,
      content_scope: "shared",
    });

    expect(properties).not.toHaveProperty("goal_id");
  });

  it("lets PostHog estimate the cost when none was reported", () => {
    const { properties } = toAiGenerationEvent({
      provenance: { ...provenance, costUsd: undefined },
      task: "course-chapters",
    });

    expect(properties).not.toHaveProperty("$ai_total_cost_usd");
    expect(properties).not.toHaveProperty("$ai_cost_passthrough");
  });

  it("adds the tier that served the call and the call's own properties", () => {
    const { properties } = toAiGenerationEvent({
      properties: { evaluation_answers: '{"reuse":{"probability":0.8,"type":"boolean"}}' },
      provenance: { ...provenance, serviceTier: "flex" },
      task: "library-identity-decision",
    });

    expect(properties).toMatchObject({
      evaluation_answers: '{"reuse":{"probability":0.8,"type":"boolean"}}',
      service_tier: "flex",
    });
  });

  it("never sends prompt or response text or empty values", () => {
    const { properties } = toAiGenerationEvent({ provenance, task: "course-chapters" });

    expect(properties).not.toHaveProperty("$ai_input");
    expect(properties).not.toHaveProperty("$ai_output_choices");
    expect(Object.values(properties)).not.toContain(undefined);
  });
});
