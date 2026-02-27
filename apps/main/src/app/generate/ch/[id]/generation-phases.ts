import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import {
  PHASE_ICONS as ACTIVITY_PHASE_ICONS,
  type PhaseName as ActivityPhaseName,
  type FirstActivityKind,
  getPhaseSteps as getActivityPhaseSteps,
  inferFirstActivityKind,
} from "@/lib/generation/activity-generation-phases";
import {
  type ActivityStepName,
  type ChapterStepName,
  type ChapterWorkflowStepName,
  type LessonStepName,
} from "@/lib/workflow/config";
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

type BasePhaseName = "preparingLessons" | "figuringOutApproach" | "settingUpActivities";

type ActivityTailPhaseName = Exclude<
  ActivityPhaseName,
  "gettingStarted" | "processingDependencies"
>;

export type PhaseName = BasePhaseName | ActivityTailPhaseName;

const BASE_PHASE_STEPS = {
  figuringOutApproach: [
    "getLesson",
    "setLessonAsRunning",
    "determineLessonKind",
    "updateLessonKind",
  ],
  preparingLessons: [
    "getChapter",
    "setChapterAsRunning",
    "generateLessons",
    "addLessons",
    "setChapterAsCompleted",
  ],
  settingUpActivities: [
    "generateCustomActivities",
    "addActivities",
    "setLessonAsCompleted",
    "getLessonActivities",
  ],
} as const satisfies Record<BasePhaseName, readonly ChapterWorkflowStepName[]>;

type AssignedSteps = (typeof BASE_PHASE_STEPS)[BasePhaseName][number] | ActivityStepName;

type _ValidateChapter = AssertAllCovered<Exclude<ChapterStepName, AssignedSteps>>;
type _ValidateLesson = AssertAllCovered<Exclude<LessonStepName, AssignedSteps>>;
type _ValidateActivity = AssertAllCovered<
  Exclude<ActivityStepName, AssignedSteps | "workflowError">
>;

const BASE_PHASE_ORDER: BasePhaseName[] = [
  "preparingLessons",
  "figuringOutApproach",
  "settingUpActivities",
];

const NON_LANGUAGE_ACTIVITY_TAIL_ORDER: ActivityTailPhaseName[] = [
  "writingContent",
  "preparingVisuals",
  "creatingImages",
  "finishing",
];

const LANGUAGE_ACTIVITY_TAIL_ORDER: ActivityTailPhaseName[] = [
  "buildingWordList",
  "addingPronunciation",
  "recordingAudio",
  "finishing",
];

function getInferredFirstActivityKind(
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
  targetLanguage: string | null,
): FirstActivityKind {
  return inferFirstActivityKind({ completedSteps, currentStep, targetLanguage });
}

function getActivityTailPhaseOrder(kind: FirstActivityKind): ActivityTailPhaseName[] {
  if (kind === "vocabulary") {
    return LANGUAGE_ACTIVITY_TAIL_ORDER;
  }

  return NON_LANGUAGE_ACTIVITY_TAIL_ORDER;
}

function getPhaseSteps(
  kind: FirstActivityKind,
): Record<PhaseName, readonly ChapterWorkflowStepName[]> {
  const activitySteps = getActivityPhaseSteps(kind);

  return {
    ...BASE_PHASE_STEPS,
    addingPronunciation: activitySteps.addingPronunciation,
    buildingWordList: activitySteps.buildingWordList,
    creatingImages: activitySteps.creatingImages,
    finishing: activitySteps.finishing,
    preparingVisuals: activitySteps.preparingVisuals,
    recordingAudio: activitySteps.recordingAudio,
    writingContent: activitySteps.writingContent,
  };
}

export function getPhaseOrder(params: {
  completedSteps: ChapterWorkflowStepName[];
  currentStep: ChapterWorkflowStepName | null;
  targetLanguage: string | null;
}): PhaseName[] {
  const kind = getInferredFirstActivityKind(
    params.completedSteps,
    params.currentStep,
    params.targetLanguage,
  );

  return [...BASE_PHASE_ORDER, ...getActivityTailPhaseOrder(kind)];
}

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  addingPronunciation: ACTIVITY_PHASE_ICONS.addingPronunciation,
  buildingWordList: ACTIVITY_PHASE_ICONS.buildingWordList,
  creatingImages: ImageIcon,
  figuringOutApproach: CompassIcon,
  finishing: CheckCircleIcon,
  preparingLessons: BookOpenIcon,
  preparingVisuals: PaletteIcon,
  recordingAudio: ACTIVITY_PHASE_ICONS.recordingAudio,
  settingUpActivities: LayoutListIcon,
  writingContent: PenLineIcon,
};

const BASE_PHASE_WEIGHTS: Record<BasePhaseName, number> = {
  figuringOutApproach: 2,
  preparingLessons: 24,
  settingUpActivities: 4,
};

function getPhaseWeights(kind: FirstActivityKind): Record<PhaseName, number> {
  if (kind === "vocabulary") {
    return {
      ...BASE_PHASE_WEIGHTS,
      addingPronunciation: 18,
      buildingWordList: 14,
      creatingImages: 0,
      finishing: 7,
      preparingVisuals: 0,
      recordingAudio: 31,
      writingContent: 0,
    };
  }

  return {
    ...BASE_PHASE_WEIGHTS,
    addingPronunciation: 0,
    buildingWordList: 0,
    creatingImages: 24,
    finishing: 2,
    preparingVisuals: 11,
    recordingAudio: 0,
    writingContent: 33,
  };
}

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
  targetLanguage: string | null,
  startedSteps?: ChapterWorkflowStepName[],
): PhaseStatus {
  const kind = getInferredFirstActivityKind(completedSteps, currentStep, targetLanguage);
  return getStatus(phase, completedSteps, currentStep, getPhaseSteps(kind), startedSteps);
}

export function calculateWeightedProgress(
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
  targetLanguage: string | null,
  startedSteps?: ChapterWorkflowStepName[],
): number {
  const kind = getInferredFirstActivityKind(completedSteps, currentStep, targetLanguage);

  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: getPhaseOrder({ completedSteps, currentStep, targetLanguage }),
    phaseSteps: getPhaseSteps(kind),
    phaseWeights: getPhaseWeights(kind),
    startedSteps,
  });
}
