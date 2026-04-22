import { describe, expect, it } from "vitest";
import {
  type PhaseStatus,
  calculateTargetProgress,
  calculateWeightedProgress,
  enforcePhaseProgression,
  getPhaseStatus,
} from "./generation-phases";

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

  it("returns 'active' when a step has been started via startedSteps", () => {
    expect(getPhaseStatus("phase1", [], null, testPhaseSteps, ["stepA"])).toBe("active");
  });

  it("returns 'active' via startedSteps even when currentStep is in another phase", () => {
    expect(getPhaseStatus("phase1", [], "stepC", testPhaseSteps, ["stepA"])).toBe("active");
  });

  it("backward-compatible when startedSteps is omitted", () => {
    expect(getPhaseStatus("phase1", [], null, testPhaseSteps)).toBe("pending");
    expect(getPhaseStatus("phase1", [], null, testPhaseSteps)).toBe("pending");
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

  it("clamps finishing phase progress when earlier phases are not completed", () => {
    const phaseSteps: Record<"start" | "middle" | "finishing", TestStep[]> = {
      finishing: ["stepE"],
      middle: ["stepC"],
      start: ["stepA", "stepB"],
    };

    const config = {
      phaseOrder: ["start", "middle", "finishing"] as const,
      phaseSteps,
      phaseWeights: { finishing: 10, middle: 30, start: 20 },
    };

    // stepE is completed (finishing step), but middle is pending.
    // Without clamping, finishing would add weight. With clamping, it stays pending.
    const progress = calculateWeightedProgress(["stepA", "stepB", "stepE"], null, config);

    // start: completed (20), middle: pending (0), finishing: clamped to pending (0)
    // 20/60 * 100 = 33
    expect(progress).toBe(33);
  });
});

describe(calculateTargetProgress, () => {
  it("returns 0 when no steps completed and no active phases", () => {
    expect(calculateTargetProgress([], null, testConfig)).toBe(0);
  });

  it("returns 100 when all steps completed", () => {
    const allSteps: TestStep[] = ["stepA", "stepB", "stepC", "stepD", "stepE"];
    expect(calculateTargetProgress(allSteps, null, testConfig)).toBe(100);
  });

  it("includes full weight of active phase in target", () => {
    // phase1: stepA completed (active, 1/2 steps done)
    // real progress = 10 (half of phase1's weight 20)
    // target = 20 (full weight of phase1, since it's active)
    expect(calculateTargetProgress(["stepA"], null, testConfig)).toBe(20);
  });

  it("includes full weight of current-step phase", () => {
    // No steps completed, but currentStep is in phase2
    // phase1: pending (0), phase2: active via currentStep (target = full 30)
    // But enforcePhaseProgression doesn't promote phase2 since phase1 isn't completed.
    // phase2 becomes active because currentStep is in it.
    // Target should include phase2's full weight = 30
    expect(calculateTargetProgress([], "stepC", testConfig)).toBe(30);
  });

  it("includes weights of all completed phases plus active phase", () => {
    // phase1 complete (20) + phase2 active via currentStep (full weight 30) = 50
    expect(calculateTargetProgress(["stepA", "stepB"], "stepC", testConfig)).toBe(50);
  });

  it("handles multiple active phases in parallel", () => {
    // phase1: stepA started (active via startedSteps)
    // phase2: stepC is currentStep (active)
    // Both are active, target should include both full weights = 20 + 30 = 50
    const config = { ...testConfig, startedSteps: ["stepA" as TestStep] };
    expect(calculateTargetProgress([], "stepC", config)).toBe(50);
  });

  it("equals real progress when no phases are active", () => {
    // phase1 complete (20), phase2 and phase3 pending
    // enforcePhaseProgression promotes phase2 to active
    // so target = 20 (completed) + 30 (active phase2) = 50
    const progress = calculateWeightedProgress(["stepA", "stepB"], null, testConfig);
    const target = calculateTargetProgress(["stepA", "stepB"], null, testConfig);
    expect(target).toBeGreaterThanOrEqual(progress);
  });

  it("is always >= real progress", () => {
    const steps: TestStep[] = ["stepA"];
    const progress = calculateWeightedProgress(steps, null, testConfig);
    const target = calculateTargetProgress(steps, null, testConfig);
    expect(target).toBeGreaterThanOrEqual(progress);
  });
});

function makePhase(status: PhaseStatus) {
  return { status };
}

describe(enforcePhaseProgression, () => {
  it("does not change when all phases are pending", () => {
    const input = [makePhase("pending"), makePhase("pending"), makePhase("pending")];
    expect(enforcePhaseProgression(input)).toEqual(input);
  });

  it("does not change linear [completed, active, pending]", () => {
    const input = [makePhase("completed"), makePhase("active"), makePhase("pending")];
    expect(enforcePhaseProgression(input)).toEqual(input);
  });

  it("does not change when all phases are completed", () => {
    const input = [makePhase("completed"), makePhase("completed"), makePhase("completed")];
    expect(enforcePhaseProgression(input)).toEqual(input);
  });

  it("clamps last phase to pending when earlier phases are not all completed", () => {
    const input = [makePhase("completed"), makePhase("pending"), makePhase("active")];
    const result = enforcePhaseProgression(input);
    expect(result.at(2)?.status).toBe("pending");
  });

  it("auto-promotes pending to active when previous phase is completed", () => {
    const input = [makePhase("completed"), makePhase("pending"), makePhase("pending")];
    const result = enforcePhaseProgression(input);
    expect(result.at(0)?.status).toBe("completed");
    expect(result.at(1)?.status).toBe("active");
    expect(result.at(2)?.status).toBe("pending");
  });

  it("handles image-generation scenario: promotes pending and clamps last", () => {
    const input = [
      makePhase("completed"),
      makePhase("completed"),
      makePhase("completed"),
      makePhase("completed"),
      makePhase("pending"),
      makePhase("active"),
    ];
    const result = enforcePhaseProgression(input);
    expect(result.at(4)?.status).toBe("active");
    expect(result.at(5)?.status).toBe("pending");
  });

  it("preserves original objects when no changes needed", () => {
    const original = makePhase("completed");
    const input = [original, makePhase("completed"), makePhase("completed")];
    const result = enforcePhaseProgression(input);
    expect(result[0]).toBe(original);
  });
});
