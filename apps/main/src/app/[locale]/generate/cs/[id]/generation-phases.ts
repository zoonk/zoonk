import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import {
  ACTIVITY_STEPS,
  CHAPTER_STEPS,
  COURSE_STEPS,
  type CourseWorkflowStepName,
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
  SaveIcon,
  SettingsIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react";

export type PhaseName =
  | "gettingReady"
  | "writingDescription"
  | "creatingCoverImage"
  | "categorizingCourse"
  | "outliningChapters"
  | "savingCourseInfo"
  | "planningLessons"
  | "figuringOutApproach"
  | "settingUpActivities"
  | "writingContent"
  | "preparingVisuals"
  | "creatingImages"
  | "finishing";

const PHASE_STEPS: Record<PhaseName, CourseWorkflowStepName[]> = {
  categorizingCourse: ["generateAlternativeTitles", "generateCategories"],
  creatingCoverImage: ["generateImage"],
  creatingImages: ["generateImages", "generateQuizImages"],
  figuringOutApproach: [
    "getLesson",
    "setLessonAsRunning",
    "determineLessonKind",
    "updateLessonKind",
  ],
  finishing: [
    "setBackgroundAsCompleted",
    "setExamplesAsCompleted",
    "setExplanationAsCompleted",
    "setMechanicsAsCompleted",
    "setQuizAsCompleted",
    "setActivityAsCompleted",
  ],
  gettingReady: [
    "getCourseSuggestion",
    "checkExistingCourse",
    "initializeCourse",
    "setCourseAsRunning",
  ],
  outliningChapters: ["generateChapters"],
  planningLessons: [
    "getChapter",
    "setChapterAsRunning",
    "generateLessons",
    "addLessons",
    "setChapterAsCompleted",
  ],
  preparingVisuals: ["generateVisuals"],
  savingCourseInfo: [
    "getExistingChapters",
    "updateCourse",
    "addAlternativeTitles",
    "addCategories",
    "addChapters",
    "completeCourseSetup",
  ],
  settingUpActivities: [
    "generateCustomActivities",
    "addActivities",
    "setLessonAsCompleted",
    "getLessonActivities",
  ],
  writingContent: [
    "setActivityAsRunning",
    "generateBackgroundContent",
    "generateExamplesContent",
    "generateExplanationContent",
    "generateMechanicsContent",
    "generateQuizContent",
  ],
  writingDescription: ["generateDescription"],
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
  "gettingReady",
  "writingDescription",
  "creatingCoverImage",
  "categorizingCourse",
  "outliningChapters",
  "savingCourseInfo",
  "planningLessons",
  "figuringOutApproach",
  "settingUpActivities",
  "writingContent",
  "preparingVisuals",
  "creatingImages",
  "finishing",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  categorizingCourse: TagIcon,
  creatingCoverImage: ImageIcon,
  creatingImages: ImageIcon,
  figuringOutApproach: CompassIcon,
  finishing: CheckCircleIcon,
  gettingReady: SettingsIcon,
  outliningChapters: LayoutListIcon,
  planningLessons: BookOpenIcon,
  preparingVisuals: PaletteIcon,
  savingCourseInfo: SaveIcon,
  settingUpActivities: LayoutListIcon,
  writingContent: SparklesIcon,
  writingDescription: PenLineIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  categorizingCourse: 3,
  creatingCoverImage: 7,
  creatingImages: 16,
  figuringOutApproach: 1,
  finishing: 1,
  gettingReady: 1,
  outliningChapters: 19,
  planningLessons: 16,
  preparingVisuals: 8,
  savingCourseInfo: 1,
  settingUpActivities: 3,
  writingContent: 21,
  writingDescription: 3,
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
