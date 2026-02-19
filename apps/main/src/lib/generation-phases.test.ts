import { describe, expect, it } from "vitest";
import { calculateWeightedProgress, getPhaseStatus } from "./generation-phases";

type TestStep = "stepA" | "stepB" | "stepC" | "stepD" | "stepE";

const testPhaseSteps: Record<"phase1" | "phase2" | "phase3", TestStep[]> = {
  phase1: ["stepA", "stepB"],
  phase2: ["stepC"],
  phase3: ["stepD", "stepE"],
};

const testConfig = {
  phaseOrder: ["phase1", "phase2", "phase3"] as const,
  phaseSteps: testPhaseSteps,
  phaseWeights: { phase1: 20, phase2: 30, phase3: 50 },
};

describe(getPhaseStatus, () => {
  it("returns 'pending' when no steps completed and no currentStep in phase", () => {
    expect(getPhaseStatus("phase1", [], null, testPhaseSteps)).toBe("pending");
  });

  it("returns 'active' when currentStep is in the phase", () => {
    expect(getPhaseStatus("phase1", [], "stepA", testPhaseSteps)).toBe("active");
  });

  it("returns 'active' when some but not all steps completed", () => {
    expect(getPhaseStatus("phase1", ["stepA"], null, testPhaseSteps)).toBe("active");
  });

  it("returns 'completed' when ALL steps in phase are completed", () => {
    expect(getPhaseStatus("phase1", ["stepA", "stepB"], null, testPhaseSteps)).toBe("completed");
  });

  it("returns 'pending' when completed steps are in OTHER phases", () => {
    expect(getPhaseStatus("phase1", ["stepC", "stepD"], null, testPhaseSteps)).toBe("pending");
  });

  it("returns 'completed' for single-step phase when that step is done", () => {
    expect(getPhaseStatus("phase2", ["stepC"], null, testPhaseSteps)).toBe("completed");
  });
});

describe(calculateWeightedProgress, () => {
  it("returns 0 when no steps completed", () => {
    expect(calculateWeightedProgress([], null, testConfig)).toBe(0);
  });

  it("returns 100 when all steps completed", () => {
    const allSteps: TestStep[] = ["stepA", "stepB", "stepC", "stepD", "stepE"];
    expect(calculateWeightedProgress(allSteps, null, testConfig)).toBe(100);
  });

  it("returns correct partial progress with weighted phases", () => {
    // phase1 fully complete (20%) + phase2 not started + phase3 not started
    const progress = calculateWeightedProgress(["stepA", "stepB"], null, testConfig);
    expect(progress).toBe(20);
  });

  it("returns partial progress within active phase", () => {
    // phase1: 1/2 steps = 10% of weight 20 = 10
    const progress = calculateWeightedProgress(["stepA"], null, testConfig);
    expect(progress).toBe(10);
  });

  it("handles single-step phases correctly", () => {
    // phase1 complete (20) + phase2 complete (30) = 50
    const progress = calculateWeightedProgress(["stepA", "stepB", "stepC"], null, testConfig);
    expect(progress).toBe(50);
  });

  it("normalizes weights that do not sum to 100", () => {
    const config = {
      phaseOrder: ["phase1", "phase2", "phase3"] as const,
      phaseSteps: testPhaseSteps,
      phaseWeights: { phase1: 10, phase2: 15, phase3: 25 },
    };

    const allSteps: TestStep[] = ["stepA", "stepB", "stepC", "stepD", "stepE"];
    expect(calculateWeightedProgress(allSteps, null, config)).toBe(100);
  });

  it("returns correct partial progress with non-100 weights", () => {
    const config = {
      phaseOrder: ["phase1", "phase2", "phase3"] as const,
      phaseSteps: testPhaseSteps,
      phaseWeights: { phase1: 10, phase2: 15, phase3: 25 },
    };

    // phase1 complete (10/50 = 20%) + phase2 complete (15/50 = 30%) = 50%
    expect(calculateWeightedProgress(["stepA", "stepB", "stepC"], null, config)).toBe(50);
  });
});
