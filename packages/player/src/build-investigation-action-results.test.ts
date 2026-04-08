import { describe, expect, test } from "vitest";
import { buildInvestigationActionResults } from "./build-investigation-action-results";

const actionContent = {
  actions: [
    { finding: "Critical evidence", label: "Check logs", quality: "critical" as const },
    { finding: "Useful data", label: "Review metrics", quality: "useful" as const },
    { finding: "Nothing here", label: "Random check", quality: "weak" as const },
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
  test("builds 3 StepAttempts with correct isCorrect based on quality", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [baseTiming, baseTiming, baseTiming],
        usedActionIndices: [0, 1, 2],
      },
      steps: [{ content: actionContent, id: 100n, kind: "investigation" }],
    });

    expect(results).toHaveLength(3);
    expect(results[0]?.isCorrect).toBe(true); // critical
    expect(results[1]?.isCorrect).toBe(true); // useful
    expect(results[2]?.isCorrect).toBe(false); // weak
  });

  test("all 3 share the same stepId", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [baseTiming, baseTiming, baseTiming],
        usedActionIndices: [0, 1, 2],
      },
      steps: [{ content: actionContent, id: 42n, kind: "investigation" }],
    });

    expect(results.every((result) => result.stepId === 42n)).toBe(true);
  });

  test("uses per-experiment timing from actionTimings", () => {
    const timings = [
      { answeredAt: 1000, dayOfWeek: 1, durationSeconds: 5, hourOfDay: 9 },
      { answeredAt: 2000, dayOfWeek: 1, durationSeconds: 8, hourOfDay: 9 },
      { answeredAt: 3000, dayOfWeek: 1, durationSeconds: 12, hourOfDay: 9 },
    ];

    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: timings,
        usedActionIndices: [0, 1, 2],
      },
      steps: [{ content: actionContent, id: 1n, kind: "investigation" }],
    });

    expect(results[0]?.durationSeconds).toBe(5);
    expect(results[1]?.durationSeconds).toBe(8);
    expect(results[2]?.durationSeconds).toBe(12);
  });

  test("stores selectedActionIndex in the answer", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [baseTiming, baseTiming],
        usedActionIndices: [2, 0],
      },
      steps: [{ content: actionContent, id: 1n, kind: "investigation" }],
    });

    expect(results[0]?.answer).toEqual({
      kind: "investigation",
      selectedActionIndex: 2,
      variant: "action",
    });
    expect(results[1]?.answer).toEqual({
      kind: "investigation",
      selectedActionIndex: 0,
      variant: "action",
    });
  });

  test("returns empty array when investigationLoop is undefined", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: undefined,
      steps: [{ content: actionContent, id: 1n, kind: "investigation" }],
    });

    expect(results).toEqual([]);
  });

  test("returns empty array when no action step exists", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [baseTiming],
        usedActionIndices: [0],
      },
      steps: [
        {
          content: { scenario: "A mystery", variant: "problem" as const },
          id: 1n,
          kind: "investigation",
        },
      ],
    });

    expect(results).toEqual([]);
  });

  test("skips entries where actionTimings and usedActionIndices are mismatched", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [baseTiming], // Only 1 timing
        usedActionIndices: [0, 1, 2], // 3 indices
      },
      steps: [{ content: actionContent, id: 1n, kind: "investigation" }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.isCorrect).toBe(true); // critical
  });

  test("returns empty array when usedActionIndices is empty", () => {
    const results = buildInvestigationActionResults({
      investigationLoop: {
        actionTimings: [],
        usedActionIndices: [],
      },
      steps: [{ content: actionContent, id: 1n, kind: "investigation" }],
    });

    expect(results).toEqual([]);
  });
});
