import { describe, expect, test } from "vitest";
import { buildInvestigationActionResults } from "./build-investigation-action-results";

const actionContent = {
  actions: [
    { finding: "Critical evidence", id: "a1", label: "Check logs", quality: "critical" as const },
    { finding: "Useful data", id: "a2", label: "Review metrics", quality: "useful" as const },
    { finding: "Nothing here", id: "a3", label: "Random check", quality: "weak" as const },
  ],
  variant: "action" as const,
};

const baseTiming = {
  answeredAt: 1_700_000_000_000,
  dayOfWeek: 3,
  durationSeconds: 10,
  hourOfDay: 14,
};

describe(buildInvestigationActionResults, () => {
  test("builds StepAttempts with correct isCorrect based on quality", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [baseTiming, baseTiming],
        usedActionIds: ["a1", "a3"],
      },
      steps: [{ content: actionContent, id: "100", kind: "investigation" }],
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.isCorrect).toBe(true); // critical
    expect(results[1]?.isCorrect).toBe(false); // weak
  });

  test("all experiments share the same stepId", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [baseTiming, baseTiming],
        usedActionIds: ["a1", "a2"],
      },
      steps: [{ content: actionContent, id: "42", kind: "investigation" }],
    });

    expect(results.every((result) => result.stepId === "42")).toBe(true);
  });

  test("uses per-experiment timing from actionTimings", () => {
    const timings = [
      { answeredAt: 1000, dayOfWeek: 1, durationSeconds: 5, hourOfDay: 9 },
      { answeredAt: 2000, dayOfWeek: 1, durationSeconds: 8, hourOfDay: 9 },
    ];

    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: timings,
        usedActionIds: ["a1", "a2"],
      },
      steps: [{ content: actionContent, id: "1", kind: "investigation" }],
    });

    expect(results[0]?.durationSeconds).toBe(5);
    expect(results[1]?.durationSeconds).toBe(8);
  });

  test("stores selectedActionId in the answer", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [baseTiming, baseTiming],
        usedActionIds: ["a3", "a1"],
      },
      steps: [{ content: actionContent, id: "1", kind: "investigation" }],
    });

    expect(results[0]?.answer).toEqual({
      kind: "investigation",
      selectedActionId: "a3",
      variant: "action",
    });
    expect(results[1]?.answer).toEqual({
      kind: "investigation",
      selectedActionId: "a1",
      variant: "action",
    });
  });

  test("returns empty array when investigationLoop is undefined", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: undefined,
      steps: [{ content: actionContent, id: "1", kind: "investigation" }],
    });

    expect(results).toEqual([]);
  });

  test("returns empty array when no action step exists", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [baseTiming],
        usedActionIds: ["a1"],
      },
      steps: [
        {
          content: { scenario: "A mystery", variant: "problem" as const },
          id: "1",
          kind: "investigation",
        },
      ],
    });

    expect(results).toEqual([]);
  });

  test("skips entries where actionTimings and usedActionIds are mismatched", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [baseTiming], // Only 1 timing
        usedActionIds: ["a1", "a2", "a3"], // 3 IDs
      },
      steps: [{ content: actionContent, id: "1", kind: "investigation" }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true); // critical
  });

  test("returns empty array when usedActionIds is empty", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [],
        usedActionIds: [],
      },
      steps: [{ content: actionContent, id: "1", kind: "investigation" }],
    });

    expect(results).toEqual([]);
  });
});
