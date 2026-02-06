import { ACTIVITY_STEPS } from "@/workflows/config";
import { type ActivityKind } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { PHASE_ICONS, getPhaseOrder, getPhaseStatus } from "./generation-phases";

const SUPPORTED_KINDS: ActivityKind[] = ["background", "explanation", "mechanics", "quiz"];

describe("generation-phases", () => {
  describe("step coverage", () => {
    it.each(SUPPORTED_KINDS)(
      "all ACTIVITY_STEPS (except workflowError) are assigned for %s",
      (kind) => {
        const stepsWithoutError = ACTIVITY_STEPS.filter((step) => step !== "workflowError");

        // Every step should resolve to a phase status when it's the currentStep
        // If a step isn't assigned, getPhaseStatus would return "pending" for all phases
        for (const step of stepsWithoutError) {
          const phases = getPhaseOrder(kind);
          const hasPhase = phases.some(
            (phase) => getPhaseStatus(phase, [], step, kind) === "active",
          );

          expect(hasPhase, `Step "${step}" is not assigned to any phase for kind "${kind}"`).toBe(
            true,
          );
        }
      },
    );
  });

  describe(getPhaseOrder, () => {
    it("returns 5 phases for background (no processingDependencies)", () => {
      const order = getPhaseOrder("background");

      expect(order).toHaveLength(5);
      expect(order).not.toContain("processingDependencies");
    });

    it("returns 6 phases for explanation (with processingDependencies)", () => {
      const order = getPhaseOrder("explanation");

      expect(order).toHaveLength(6);
      expect(order).toContain("processingDependencies");
    });

    it("returns 6 phases for mechanics", () => {
      const order = getPhaseOrder("mechanics");

      expect(order).toHaveLength(6);
      expect(order).toContain("processingDependencies");
    });

    it("returns 6 phases for quiz", () => {
      const order = getPhaseOrder("quiz");

      expect(order).toHaveLength(6);
      expect(order).toContain("processingDependencies");
    });
  });

  describe("dependency steps", () => {
    it("background has no processingDependencies phase", () => {
      const order = getPhaseOrder("background");
      expect(order).not.toContain("processingDependencies");
    });

    it("explanation processingDependencies includes generateBackgroundContent", () => {
      // If generateBackgroundContent is in processingDependencies, it should be "active" there
      const status = getPhaseStatus(
        "processingDependencies",
        [],
        "generateBackgroundContent",
        "explanation",
      );
      expect(status).toBe("active");
    });

    it("mechanics processingDependencies includes generateBackgroundContent and generateExplanationContent", () => {
      const statusBg = getPhaseStatus(
        "processingDependencies",
        [],
        "generateBackgroundContent",
        "mechanics",
      );
      const statusExp = getPhaseStatus(
        "processingDependencies",
        [],
        "generateExplanationContent",
        "mechanics",
      );
      expect(statusBg).toBe("active");
      expect(statusExp).toBe("active");
    });

    it("quiz processingDependencies includes generateBackgroundContent and generateExplanationContent", () => {
      const statusBg = getPhaseStatus(
        "processingDependencies",
        [],
        "generateBackgroundContent",
        "quiz",
      );
      const statusExp = getPhaseStatus(
        "processingDependencies",
        [],
        "generateExplanationContent",
        "quiz",
      );
      expect(statusBg).toBe("active");
      expect(statusExp).toBe("active");
    });
  });

  describe("PHASE_ICONS", () => {
    it("has an icon for every phase", () => {
      const allPhases = new Set(SUPPORTED_KINDS.flatMap((kind) => getPhaseOrder(kind)));

      for (const phase of allPhases) {
        expect(PHASE_ICONS[phase]).toBeDefined();
      }
    });
  });
});
