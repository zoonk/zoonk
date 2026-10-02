import { describe, expect, it } from "vitest";
import { type TaskProvenance } from "../provenance/task-provenance";
import { toEvaluationEvent, toEvaluationRunRecord } from "./evaluation-event";

const provenance: TaskProvenance = {
  costUsd: 0.000004,
  generatedAt: "2026-09-27T12:00:00.000Z",
  latencyMs: 250,
  model: "openai/gpt-6-luna",
  promptVersion: "a1b2c3d4e5f6",
  provider: "openai",
  requestedModel: "typesafe-ai/jev",
  runId: "run-1",
  usage: { inputTokens: 90, outputTokens: 0 },
};

describe(toEvaluationEvent, () => {
  it("logs the answers next to the usual generation fields", () => {
    const event = toEvaluationEvent({
      analytics: { contentScope: "personal", distinctId: "user-1", goalId: "goal-1" },
      answers: {
        lasting: { probability: 0.91, type: "boolean" },
        route: { choice: "exam", probabilities: { exam: 0.8, learn: 0.2 }, type: "choice" },
      },
      provenance,
      task: "memory-gate",
    });

    expect(event).toStrictEqual({
      distinctId: "user-1",
      event: "$ai_generation",
      properties: {
        $ai_cache_reporting_exclusive: false,
        $ai_cost_passthrough: true,
        $ai_input_tokens: 90,
        $ai_latency: 0.25,
        $ai_model: "openai/gpt-6-luna",
        $ai_output_tokens: 0,
        $ai_provider: "openai",
        $ai_span_id: "run-1",
        $ai_span_name: "memory-gate",
        $ai_total_cost_usd: 0.000004,
        $ai_trace_id: "run-1",
        content_scope: "personal",
        evaluation_answers:
          '{"lasting":{"probability":0.91,"type":"boolean"},"route":{"choice":"exam","probabilities":{"exam":0.8,"learn":0.2},"type":"choice"}}',
        goal_id: "goal-1",
        prompt_version: "a1b2c3d4e5f6",
        requested_model: "typesafe-ai/jev",
        task: "memory-gate",
      },
    });
  });

  it("keeps system work off person profiles", () => {
    const event = toEvaluationEvent({
      answers: { sameExam: { probability: 0.7, type: "boolean" } },
      provenance: { ...provenance, costUsd: undefined },
      task: "exam-identity-decision",
    });

    expect(event.distinctId).toBe("zoonk-system");

    expect(event.properties).toMatchObject({
      $process_person_profile: false,
      content_scope: "shared",
    });

    expect(event.properties).not.toHaveProperty("$ai_total_cost_usd");
  });
});

describe(toEvaluationRunRecord, () => {
  const answers = { reuse: { probability: 0.82, type: "boolean" as const } };
  const input = { CANDIDATE: "Newtonian mechanics", REQUEST: "Classical mechanics" };
  const state = "<CANDIDATE>Newtonian mechanics</CANDIDATE>";

  it("keeps a shared task's input with its verdict, model and cost", () => {
    const record = toEvaluationRunRecord({
      answers,
      input,
      keepInput: true,
      provenance,
      state,
      task: "library-identity-decision",
    });

    expect(record).toStrictEqual({
      answers,
      contentScope: "shared",
      costUsd: 0.000004,
      distinctId: undefined,
      goalId: undefined,
      input,
      inputHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      inputTokens: 90,
      latencyMs: 250,
      model: "openai/gpt-6-luna",
      outputTokens: 0,
      promptVersion: "a1b2c3d4e5f6",
      requestedModel: "typesafe-ai/jev",
      task: "library-identity-decision",
      traceId: undefined,
    });
  });

  it("logs only the hash of text the task doesn't keep", () => {
    const record = toEvaluationRunRecord({
      analytics: { contentScope: "personal", distinctId: "user-1" },
      answers,
      input,
      keepInput: false,
      provenance,
      state,
      task: "memory-gate",
    });

    expect(record.input).toBeNull();
    expect(record.distinctId).toBe("user-1");

    const same = toEvaluationRunRecord({
      answers,
      input,
      keepInput: false,
      provenance,
      state,
      task: "memory-gate",
    });

    expect(same.inputHash).toBe(record.inputHash);
  });

  it("never keeps a learner's text without the learner it could be deleted with", () => {
    const record = toEvaluationRunRecord({
      analytics: { contentScope: "personal" },
      answers,
      input: { QUESTION: "Why is my invoice late?" },
      keepInput: true,
      provenance,
      state,
      task: "question-generality",
    });

    expect(record.input).toBeNull();
  });
});
