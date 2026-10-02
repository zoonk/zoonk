import { describe, expect, it } from "vitest";
import {
  decideMemoryGate,
  decideMemoryReconcile,
  getMemoryReconcileLabels,
} from "./memory-decisions";

describe(decideMemoryGate, () => {
  const lastingEveryday = { explicitlyAsked: 0.05, lasting: 0.9, sensitive: 0.05 };

  it("keeps a lasting everyday fact", () => {
    expect(
      decideMemoryGate({ allowSensitive: true, probabilities: lastingEveryday }),
    ).toStrictEqual({ decision: "keep", sensitive: false });
  });

  it("drops a passing fact even when the learner asked to keep it", () => {
    expect(
      decideMemoryGate({
        allowSensitive: true,
        probabilities: { explicitlyAsked: 0.95, lasting: 0.2, sensitive: 0.05 },
      }),
    ).toStrictEqual({ decision: "notLasting", sensitive: false });
  });

  it("drops a sensitive fact the learner only stated", () => {
    expect(
      decideMemoryGate({
        allowSensitive: true,
        probabilities: { explicitlyAsked: 0.1, lasting: 0.9, sensitive: 0.4 },
      }),
    ).toStrictEqual({ decision: "sensitive", sensitive: true });
  });

  it("keeps a sensitive fact an adult explicitly asked to remember, flagged as sensitive", () => {
    expect(
      decideMemoryGate({
        allowSensitive: true,
        probabilities: { explicitlyAsked: 0.9, lasting: 0.9, sensitive: 0.95 },
      }),
    ).toStrictEqual({ decision: "keep", sensitive: true });
  });

  it("never keeps a sensitive fact for learners who may not store one, even when asked", () => {
    expect(
      decideMemoryGate({
        allowSensitive: false,
        probabilities: { explicitlyAsked: 0.99, lasting: 0.9, sensitive: 0.9 },
      }),
    ).toStrictEqual({ decision: "sensitive", sensitive: true });
  });
});

describe(getMemoryReconcileLabels, () => {
  it("offers add and ignore plus a replace and remove per related fact", () => {
    expect(Object.keys(getMemoryReconcileLabels(2))).toStrictEqual([
      "add",
      "ignore",
      "replace_1",
      "replace_2",
      "remove_1",
      "remove_2",
    ]);
  });
});

describe(decideMemoryReconcile, () => {
  it("reads a 1-based label into a 0-based fact position", () => {
    expect(
      decideMemoryReconcile({
        choice: "replace_2",
        existingCount: 3,
        intent: "remember",
        probabilities: { replace_2: 0.8 },
      }),
    ).toStrictEqual({ action: "replace", index: 1 });
  });

  it("keeps the new fact when a replace isn't a clear majority", () => {
    expect(
      decideMemoryReconcile({
        choice: "replace_1",
        existingCount: 2,
        intent: "remember",
        probabilities: { add: 0.35, replace_1: 0.4 },
      }),
    ).toStrictEqual({ action: "add" });
  });

  it("trusts a pick from a model that reports no distribution", () => {
    expect(
      decideMemoryReconcile({ choice: "remove_1", existingCount: 1, intent: "remember" }),
    ).toStrictEqual({ action: "remove", index: 0 });
  });

  it("falls back to the safe action for a label outside the list", () => {
    expect(
      decideMemoryReconcile({ choice: "replace_4", existingCount: 2, intent: "remember" }),
    ).toStrictEqual({ action: "add" });

    expect(
      decideMemoryReconcile({ choice: "update", existingCount: 2, intent: "forget" }),
    ).toStrictEqual({ action: "ignore" });
  });

  it("never stores a fact to forget", () => {
    expect(
      decideMemoryReconcile({ choice: "add", existingCount: 2, intent: "forget" }),
    ).toStrictEqual({ action: "ignore" });

    expect(
      decideMemoryReconcile({ choice: "replace_2", existingCount: 2, intent: "forget" }),
    ).toStrictEqual({ action: "remove", index: 1 });
  });

  it("does nothing for an unsure removal", () => {
    expect(
      decideMemoryReconcile({
        choice: "remove_1",
        existingCount: 1,
        intent: "forget",
        probabilities: { ignore: 0.45, remove_1: 0.46 },
      }),
    ).toStrictEqual({ action: "ignore" });
  });
});
