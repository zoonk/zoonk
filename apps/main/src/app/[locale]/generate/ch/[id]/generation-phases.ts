import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import {
  type ActivityStepName,
  type ChapterStepName,
  type ChapterWorkflowStepName,
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
} from "lucide-react";

export type PhaseName =
  | "preparingLessons"
  | "figuringOutApproach"
  | "settingUpActivities"
  | "writingContent"
  | "preparingVisuals"
  | "creatingImages"
  | "finishing";

const PHASE_STEPS = {
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
    "setCustomAsCompleted",
    "setExamplesAsCompleted",
    "setExplanationAsCompleted",
    "setMechanicsAsCompleted",
    "setQuizAsCompleted",
    "setReviewAsCompleted",
    "setStoryAsCompleted",
    "setVocabularyAsCompleted",
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
    "generateChallengeContent",
    "generateCustomContent",
    "generateExamplesContent",
    "generateExplanationContent",
    "generateMechanicsContent",
    "generateQuizContent",
    "generateReviewContent",
    "generateStoryContent",
    "generateVocabularyContent",
    "saveVocabularyWords",
    "generateVocabularyPronunciation",
    "generateVocabularyAudio",
    "updateVocabularyEnrichments",
  ],
} as const satisfies Record<PhaseName, readonly ChapterWorkflowStepName[]>;

// Compile-time check: typecheck fails with the exact missing step names.
type AssignedSteps = (typeof PHASE_STEPS)[PhaseName][number];
type _ValidateChapter = AssertAllCovered<Exclude<ChapterStepName, AssignedSteps>>;
type _ValidateLesson = AssertAllCovered<Exclude<LessonStepName, AssignedSteps>>;
type _ValidateActivity = AssertAllCovered<
  Exclude<ActivityStepName, AssignedSteps | "workflowError">
>;

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
  creatingImages: 24,
  figuringOutApproach: 2,
  finishing: 2,
  preparingLessons: 24,
  preparingVisuals: 11,
  settingUpActivities: 4,
  writingContent: 33,
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
