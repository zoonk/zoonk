import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import {
  ACTIVITY_STEPS,
  CHAPTER_STEPS,
  type ChapterWorkflowStepName,
  LESSON_STEPS,
} from "@/workflows/config";
import {
  BookOpenIcon,
  CheckCircleIcon,
  CompassIcon,
  ImageIcon,
  LayoutListIcon,
  type LucideIcon,
  PaletteIcon,
  PenLineIcon,
} from "lucide-react";

export type PhaseName =
  | "preparingLessons"
  | "figuringOutApproach"
  | "settingUpActivities"
  | "writingContent"
  | "preparingVisuals"
  | "creatingImages"
  | "finishing";

const PHASE_STEPS: Record<PhaseName, ChapterWorkflowStepName[]> = {
  creatingImages: ["generateImages", "generateQuizImages"],
  figuringOutApproach: [
    "getLesson",
    "setLessonAsRunning",
    "determineLessonKind",
    "updateLessonKind",
  ],
  finishing: [
    "setBackgroundAsCompleted",
    "setExplanationAsCompleted",
    "setMechanicsAsCompleted",
    "setQuizAsCompleted",
    "setActivityAsCompleted",
  ],
  preparingLessons: [
    "getChapter",
    "setChapterAsRunning",
    "generateLessons",
    "addLessons",
    "setChapterAsCompleted",
  ],
  preparingVisuals: ["generateVisuals"],
  settingUpActivities: [
    "generateCustomActivities",
    "addActivities",
    "setLessonAsCompleted",
    "getLessonActivities",
  ],
  writingContent: [
    "setActivityAsRunning",
    "generateBackgroundContent",
    "generateExplanationContent",
    "generateMechanicsContent",
    "generateQuizContent",
  ],
};

// Runtime check: ensure all steps are assigned to a phase.
const allPhaseSteps = new Set(Object.values(PHASE_STEPS).flat());
const missingChapterSteps = CHAPTER_STEPS.filter((step) => !allPhaseSteps.has(step));

if (missingChapterSteps.length > 0) {
  throw new Error(
    `Missing chapter steps in PHASE_STEPS: ${missingChapterSteps.join(", ")}. ` +
      "Add them to the appropriate phase in generation-phases.ts",
  );
}

const missingLessonSteps = LESSON_STEPS.filter((step) => !allPhaseSteps.has(step));

if (missingLessonSteps.length > 0) {
  throw new Error(
    `Missing lesson steps in PHASE_STEPS: ${missingLessonSteps.join(", ")}. ` +
      "Add them to the appropriate phase in generation-phases.ts",
  );
}

const missingActivitySteps = ACTIVITY_STEPS.filter(
  (step) => step !== "workflowError" && !allPhaseSteps.has(step),
);

if (missingActivitySteps.length > 0) {
  throw new Error(
    `Missing activity steps in PHASE_STEPS: ${missingActivitySteps.join(", ")}. ` +
      "Add them to the appropriate phase in generation-phases.ts",
  );
}

export const PHASE_ORDER: PhaseName[] = [
  "preparingLessons",
  "figuringOutApproach",
  "settingUpActivities",
  "writingContent",
  "preparingVisuals",
  "creatingImages",
  "finishing",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  creatingImages: ImageIcon,
  figuringOutApproach: CompassIcon,
  finishing: CheckCircleIcon,
  preparingLessons: BookOpenIcon,
  preparingVisuals: PaletteIcon,
  settingUpActivities: LayoutListIcon,
  writingContent: PenLineIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  creatingImages: 20,
  figuringOutApproach: 3,
  finishing: 1,
  preparingLessons: 5,
  preparingVisuals: 22,
  settingUpActivities: 3,
  writingContent: 20,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS);
}

export function calculateWeightedProgress(
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
): number {
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: PHASE_ORDER,
    phaseSteps: PHASE_STEPS,
    phaseWeights: PHASE_WEIGHTS,
  });
}
