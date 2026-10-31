import { describe, expect, it } from "vitest";
import { type TaskProvenance } from "../provenance/task-provenance";
import { toEvaluationRunRecord } from "./evaluation-event";

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

describe(toEvaluationRunRecord, () => {
  const answers = { reuse: { probability: 0.82, type: "boolean" as const } };
  const input = { CANDIDATE: "Newtonian mechanics", REQUEST: "Classical mechanics" };
  const state = "<CANDIDATE>Newtonian mechanics</CANDIDATE>";

  it("keeps a shared task's input with its verdict, model and run", () => {
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
      distinctId: undefined,
      goalId: undefined,
      input,
      inputHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      latencyMs: 250,
      model: "openai/gpt-6-luna",
      promptVersion: "a1b2c3d4e5f6",
      requestedModel: "typesafe-ai/jev",
      runId: "run-1",
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
