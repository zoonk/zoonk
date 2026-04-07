import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

/**
 * Investigation phase step config.
 *
 * Investigation runs 7 AI tasks in a dependency chain:
 * scenario → accuracy → actions → findings → {debrief, interpretations, visuals} (parallel)
 * Then visual content dispatch → save.
 * Each AI call gets its own phase. The parallel tier (analyzingEvidence,
 * writingTheReveal, preparingVisuals) may complete out of order — same
 * behavior as listening's parallel phases.
 *
 * See activity-generation-phase-config.ts for the phase grouping rules.
 */

type InvestigationSteps =
  | "getLessonActivities"
  | "setActivityAsRunning"
  | "generateInvestigationScenario"
  | "generateInvestigationAccuracy"
  | "generateInvestigationActions"
  | "generateInvestigationFindings"
  | "generateInvestigationInterpretations"
  | "generateInvestigationDebrief"
  | "generateInvestigationVisuals"
  | "generateInvestigationVisualContent"
  | "saveInvestigationActivity";

export const INVESTIGATION_PHASE_STEPS = {
  analyzingEvidence: ["generateInvestigationInterpretations"],
  classifyingExplanations: ["generateInvestigationAccuracy"],
  creatingVisuals: ["generateInvestigationVisualContent"],
  designingActions: ["generateInvestigationActions"],
  gatheringEvidence: ["generateInvestigationFindings"],
  gettingStarted: ["getLessonActivities", "setActivityAsRunning"],
  preparingVisuals: ["generateInvestigationVisuals"],
  saving: ["saveInvestigationActivity"],
  settingTheScene: ["generateInvestigationScenario"],
  writingTheReveal: ["generateInvestigationDebrief"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateInvestigation = AssertAllCovered<
  Exclude<
    InvestigationSteps,
    (typeof INVESTIGATION_PHASE_STEPS)[keyof typeof INVESTIGATION_PHASE_STEPS][number]
  >
>;

export const INVESTIGATION_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "settingTheScene",
  "classifyingExplanations",
  "designingActions",
  "gatheringEvidence",
  "analyzingEvidence",
  "writingTheReveal",
  "preparingVisuals",
  "creatingVisuals",
  "saving",
];
