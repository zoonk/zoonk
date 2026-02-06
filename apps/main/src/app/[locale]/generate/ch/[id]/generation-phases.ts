import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import {
  ACTIVITY_STEPS,
  type ActivityStepName,
  CHAPTER_STEPS,
  type ChapterWorkflowStepName,
  LESSON_STEPS,
} from "@/workflows/config";
import {
  BookOpenIcon,
  GraduationCapIcon,
  LayoutListIcon,
  type LucideIcon,
  SparklesIcon,
} from "lucide-react";

export type PhaseName =
  | "loadingInfo"
  | "generatingLessons"
  | "settingUpActivities"
  | "generatingActivities";

const activityPhaseSteps: ActivityStepName[] = ACTIVITY_STEPS.filter(
  (step) => step !== "workflowError",
);

const PHASE_STEPS: Record<PhaseName, ChapterWorkflowStepName[]> = {
  generatingActivities: activityPhaseSteps,
  generatingLessons: ["generateLessons", "addLessons", "setChapterAsCompleted"],
  loadingInfo: ["getChapter", "setChapterAsRunning"],
  settingUpActivities: [...LESSON_STEPS],
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
  "loadingInfo",
  "generatingLessons",
  "settingUpActivities",
  "generatingActivities",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  generatingActivities: SparklesIcon,
  generatingLessons: GraduationCapIcon,
  loadingInfo: BookOpenIcon,
  settingUpActivities: LayoutListIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  generatingActivities: 75,
  generatingLessons: 8,
  loadingInfo: 2,
  settingUpActivities: 15,
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
