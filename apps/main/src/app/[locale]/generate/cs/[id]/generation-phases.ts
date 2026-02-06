import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import {
  ACTIVITY_STEPS,
  type ActivityStepName,
  CHAPTER_STEPS,
  COURSE_STEPS,
  type CourseWorkflowStepName,
  LESSON_STEPS,
} from "@/workflows/config";
import {
  BookOpenIcon,
  GraduationCapIcon,
  LayoutListIcon,
  type LucideIcon,
  SaveIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react";

export type PhaseName =
  | "loadingInfo"
  | "checkingExisting"
  | "settingUp"
  | "generatingDetails"
  | "savingMetadata"
  | "planningChapters"
  | "generatingLessons"
  | "generatingActivities";

const activityPhaseSteps: ActivityStepName[] = ACTIVITY_STEPS.filter(
  (step) => step !== "workflowError",
);

const PHASE_STEPS: Record<PhaseName, CourseWorkflowStepName[]> = {
  checkingExisting: ["checkExistingCourse"],
  generatingActivities: activityPhaseSteps,
  generatingDetails: [
    "generateDescription",
    "generateImage",
    "generateAlternativeTitles",
    "generateCategories",
  ],
  generatingLessons: [...CHAPTER_STEPS, ...LESSON_STEPS],
  loadingInfo: ["getCourseSuggestion"],
  planningChapters: [
    "getExistingChapters",
    "generateChapters",
    "addChapters",
    "completeCourseSetup",
  ],
  savingMetadata: ["updateCourse", "addAlternativeTitles", "addCategories"],
  settingUp: ["initializeCourse", "setCourseAsRunning"],
};

// Runtime check: ensure all course steps are assigned to a phase.
// This runs at module load time and will throw during build if any step is missing.
const allPhaseSteps = new Set(Object.values(PHASE_STEPS).flat());
const missingCourseSteps = COURSE_STEPS.filter((step) => !allPhaseSteps.has(step));

if (missingCourseSteps.length > 0) {
  throw new Error(
    `Missing course steps in PHASE_STEPS: ${missingCourseSteps.join(", ")}. ` +
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
  "checkingExisting",
  "settingUp",
  "generatingDetails",
  "savingMetadata",
  "planningChapters",
  "generatingLessons",
  "generatingActivities",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  checkingExisting: SearchIcon,
  generatingActivities: ZapIcon,
  generatingDetails: SparklesIcon,
  generatingLessons: GraduationCapIcon,
  loadingInfo: BookOpenIcon,
  planningChapters: LayoutListIcon,
  savingMetadata: SaveIcon,
  settingUp: SettingsIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  checkingExisting: 1,
  generatingActivities: 30,
  generatingDetails: 15,
  generatingLessons: 15,
  loadingInfo: 1,
  planningChapters: 35,
  savingMetadata: 2,
  settingUp: 1,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS);
}

export function calculateWeightedProgress(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
): number {
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: PHASE_ORDER,
    phaseSteps: PHASE_STEPS,
    phaseWeights: PHASE_WEIGHTS,
  });
}
