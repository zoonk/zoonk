import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { ACTIVITY_STEPS, type ActivityStepName } from "@/workflows/config";
import { type ActivityKind } from "@zoonk/db";
import {
  BookOpenIcon,
  CheckCircleIcon,
  ImageIcon,
  LayersIcon,
  type LucideIcon,
  PaletteIcon,
  PenLineIcon,
} from "lucide-react";

export type PhaseName =
  | "gettingStarted"
  | "processingDependencies"
  | "writingContent"
  | "preparingVisuals"
  | "creatingImages"
  | "finishing";

export function getPhaseOrder(kind: ActivityKind): PhaseName[] {
  if (kind === "background") {
    return ["gettingStarted", "writingContent", "preparingVisuals", "creatingImages", "finishing"];
  }

  if (kind === "story") {
    return ["gettingStarted", "processingDependencies", "writingContent", "finishing"];
  }

  return [
    "gettingStarted",
    "processingDependencies",
    "writingContent",
    "preparingVisuals",
    "creatingImages",
    "finishing",
  ];
}

function getPhaseSteps(kind: ActivityKind): Record<PhaseName, ActivityStepName[]> {
  const shared = {
    creatingImages: ["generateImages", "generateQuizImages"] as ActivityStepName[],
    gettingStarted: ["getLessonActivities"] as ActivityStepName[],
    preparingVisuals: ["generateVisuals"] as ActivityStepName[],
  };

  if (kind === "background") {
    return {
      ...shared,
      finishing: [
        "generateExamplesContent",
        "generateExplanationContent",
        "generateMechanicsContent",
        "generateQuizContent",
        "generateStoryContent",
        "setBackgroundAsCompleted",
        "setExamplesAsCompleted",
        "setExplanationAsCompleted",
        "setMechanicsAsCompleted",
        "setQuizAsCompleted",
        "setStoryAsCompleted",
        "setActivityAsCompleted",
      ],
      processingDependencies: [],
      writingContent: ["setActivityAsRunning", "generateBackgroundContent"],
    };
  }

  if (kind === "explanation") {
    return {
      ...shared,
      finishing: [
        "generateExamplesContent",
        "generateMechanicsContent",
        "generateQuizContent",
        "generateStoryContent",
        "setBackgroundAsCompleted",
        "setExamplesAsCompleted",
        "setExplanationAsCompleted",
        "setMechanicsAsCompleted",
        "setQuizAsCompleted",
        "setStoryAsCompleted",
        "setActivityAsCompleted",
      ],
      processingDependencies: ["setActivityAsRunning", "generateBackgroundContent"],
      writingContent: ["generateExplanationContent"],
    };
  }

  if (kind === "mechanics") {
    return {
      ...shared,
      finishing: [
        "generateExamplesContent",
        "generateQuizContent",
        "generateStoryContent",
        "setBackgroundAsCompleted",
        "setExamplesAsCompleted",
        "setExplanationAsCompleted",
        "setMechanicsAsCompleted",
        "setQuizAsCompleted",
        "setStoryAsCompleted",
        "setActivityAsCompleted",
      ],
      processingDependencies: [
        "setActivityAsRunning",
        "generateBackgroundContent",
        "generateExplanationContent",
      ],
      writingContent: ["generateMechanicsContent"],
    };
  }

  if (kind === "examples") {
    return {
      ...shared,
      finishing: [
        "generateMechanicsContent",
        "generateQuizContent",
        "generateStoryContent",
        "setBackgroundAsCompleted",
        "setExamplesAsCompleted",
        "setExplanationAsCompleted",
        "setMechanicsAsCompleted",
        "setQuizAsCompleted",
        "setStoryAsCompleted",
        "setActivityAsCompleted",
      ],
      processingDependencies: [
        "setActivityAsRunning",
        "generateBackgroundContent",
        "generateExplanationContent",
      ],
      writingContent: ["generateExamplesContent"],
    };
  }

  if (kind === "story") {
    return {
      ...shared,
      finishing: [
        "generateExamplesContent",
        "generateMechanicsContent",
        "generateQuizContent",
        "setBackgroundAsCompleted",
        "setExamplesAsCompleted",
        "setExplanationAsCompleted",
        "setMechanicsAsCompleted",
        "setQuizAsCompleted",
        "setStoryAsCompleted",
        "setActivityAsCompleted",
      ],
      processingDependencies: [
        "setActivityAsRunning",
        "generateBackgroundContent",
        "generateExplanationContent",
      ],
      writingContent: ["generateStoryContent"],
    };
  }

  // quiz (and fallback for other kinds)
  return {
    ...shared,
    finishing: [
      "generateExamplesContent",
      "generateMechanicsContent",
      "generateStoryContent",
      "setBackgroundAsCompleted",
      "setExamplesAsCompleted",
      "setExplanationAsCompleted",
      "setMechanicsAsCompleted",
      "setQuizAsCompleted",
      "setStoryAsCompleted",
      "setActivityAsCompleted",
    ],
    processingDependencies: [
      "setActivityAsRunning",
      "generateBackgroundContent",
      "generateExplanationContent",
    ],
    writingContent: ["generateQuizContent"],
  };
}

function getPhaseWeights(kind: ActivityKind): Record<PhaseName, number> {
  if (kind === "background") {
    return {
      creatingImages: 43,
      finishing: 7,
      gettingStarted: 3,
      preparingVisuals: 22,
      processingDependencies: 0,
      writingContent: 25,
    };
  }

  if (kind === "story") {
    return {
      creatingImages: 0,
      finishing: 10,
      gettingStarted: 5,
      preparingVisuals: 0,
      processingDependencies: 40,
      writingContent: 45,
    };
  }

  return {
    creatingImages: 35,
    finishing: 9,
    gettingStarted: 3,
    preparingVisuals: 18,
    processingDependencies: 15,
    writingContent: 20,
  };
}

const SUPPORTED_KINDS: ActivityKind[] = [
  "background",
  "examples",
  "explanation",
  "mechanics",
  "quiz",
  "story",
];

for (const kind of SUPPORTED_KINDS) {
  const phaseSteps = getPhaseSteps(kind);
  const allPhaseSteps = new Set(Object.values(phaseSteps).flat());
  const missingSteps = ACTIVITY_STEPS.filter(
    (step) => step !== "workflowError" && !allPhaseSteps.has(step),
  );

  if (missingSteps.length > 0) {
    throw new Error(
      `Missing activity steps for kind "${kind}": ${missingSteps.join(", ")}. ` +
        "Add them to the appropriate phase in generation-phases.ts",
    );
  }
}

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  creatingImages: ImageIcon,
  finishing: CheckCircleIcon,
  gettingStarted: BookOpenIcon,
  preparingVisuals: PaletteIcon,
  processingDependencies: LayersIcon,
  writingContent: PenLineIcon,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
): PhaseStatus {
  const phaseSteps = getPhaseSteps(activityKind);
  return getStatus(phase, completedSteps, currentStep, phaseSteps);
}

export function calculateWeightedProgress(
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
): number {
  const phaseSteps = getPhaseSteps(activityKind);
  const phaseOrder = getPhaseOrder(activityKind);
  const phaseWeights = getPhaseWeights(activityKind);
  return calculateProgress(completedSteps, currentStep, { phaseOrder, phaseSteps, phaseWeights });
}
