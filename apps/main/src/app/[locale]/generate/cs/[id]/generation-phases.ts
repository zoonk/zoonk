import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import {
  type ActivityStepName,
  type ChapterStepName,
  type CourseStepName,
  type CourseWorkflowStepName,
  type LessonStepName,
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

const PHASE_STEPS = {
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
    "setChallengeAsCompleted",
    "setExamplesAsCompleted",
    "setExplanationAsCompleted",
    "setMechanicsAsCompleted",
    "setQuizAsCompleted",
    "setReviewAsCompleted",
    "setStoryAsCompleted",
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
    "generateChallengeContent",
    "generateExamplesContent",
    "generateExplanationContent",
    "generateMechanicsContent",
    "generateQuizContent",
    "generateReviewContent",
    "generateStoryContent",
  ],
  writingDescription: ["generateDescription"],
} as const satisfies Record<PhaseName, readonly CourseWorkflowStepName[]>;

// Compile-time check: typecheck fails with the exact missing step names.
type AssignedSteps = (typeof PHASE_STEPS)[PhaseName][number];
type _ValidateCourse = AssertAllCovered<Exclude<CourseStepName, AssignedSteps>>;
type _ValidateChapter = AssertAllCovered<Exclude<ChapterStepName, AssignedSteps>>;
type _ValidateLesson = AssertAllCovered<Exclude<LessonStepName, AssignedSteps>>;
type _ValidateActivity = AssertAllCovered<
  Exclude<ActivityStepName, AssignedSteps | "workflowError">
>;

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
