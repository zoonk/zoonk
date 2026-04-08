import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

/**
 * Investigation phase step config.
 *
 * Investigation runs 4 AI tasks in a dependency chain:
 * scenario → accuracy (with feedback) → actions → findings → save
 *
 * Each AI call gets its own phase. The accuracy task also produces
 * per-explanation feedback, replacing the former debrief step.
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
  | "saveInvestigationActivity";

export const INVESTIGATION_PHASE_STEPS = {
  classifyingExplanations: ["generateInvestigationAccuracy"],
  designingActions: ["generateInvestigationActions"],
  gatheringEvidence: ["generateInvestigationFindings"],
  gettingStarted: ["getLessonActivities", "setActivityAsRunning"],
  saving: ["saveInvestigationActivity"],
  settingTheScene: ["generateInvestigationScenario"],
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
  "saving",
];
