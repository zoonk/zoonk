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

type BasePhaseName =
  | "gettingReady"
  | "writingDescription"
  | "creatingCoverImage"
  | "categorizingCourse"
  | "outliningChapters"
  | "savingCourseInfo"
  | "planningLessons"
  | "figuringOutApproach"
  | "settingUpActivities";

type ActivityTailPhaseName = Exclude<
  ActivityPhaseName,
  "gettingStarted" | "processingDependencies"
>;

export type PhaseName = BasePhaseName | ActivityTailPhaseName;

const BASE_PHASE_STEPS = {
  categorizingCourse: ["generateAlternativeTitles", "generateCategories"],
  creatingCoverImage: ["generateImage"],
  figuringOutApproach: [
    "getLesson",
    "setLessonAsRunning",
    "determineLessonKind",
    "updateLessonKind",
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
  writingDescription: ["generateDescription"],
} as const satisfies Record<BasePhaseName, readonly CourseWorkflowStepName[]>;

type AssignedSteps = (typeof BASE_PHASE_STEPS)[BasePhaseName][number] | ActivityStepName;

type _ValidateCourse = AssertAllCovered<Exclude<CourseStepName, AssignedSteps>>;
type _ValidateChapter = AssertAllCovered<Exclude<ChapterStepName, AssignedSteps>>;
type _ValidateLesson = AssertAllCovered<Exclude<LessonStepName, AssignedSteps>>;
type _ValidateActivity = AssertAllCovered<
  Exclude<ActivityStepName, AssignedSteps | "workflowError">
>;

const BASE_PHASE_ORDER: BasePhaseName[] = [
  "gettingReady",
  "writingDescription",
  "creatingCoverImage",
  "categorizingCourse",
  "outliningChapters",
  "savingCourseInfo",
  "planningLessons",
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
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
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
): Record<PhaseName, readonly CourseWorkflowStepName[]> {
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
  completedSteps: CourseWorkflowStepName[];
  currentStep: CourseWorkflowStepName | null;
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
  categorizingCourse: TagIcon,
  creatingCoverImage: ImageIcon,
  creatingImages: ImageIcon,
  figuringOutApproach: CompassIcon,
  finishing: CheckCircleIcon,
  gettingReady: SettingsIcon,
  outliningChapters: LayoutListIcon,
  planningLessons: BookOpenIcon,
  preparingVisuals: PaletteIcon,
  recordingAudio: ACTIVITY_PHASE_ICONS.recordingAudio,
  savingCourseInfo: SaveIcon,
  settingUpActivities: LayoutListIcon,
  writingContent: SparklesIcon,
  writingDescription: PenLineIcon,
};

const BASE_PHASE_WEIGHTS: Record<BasePhaseName, number> = {
  categorizingCourse: 3,
  creatingCoverImage: 7,
  figuringOutApproach: 1,
  gettingReady: 1,
  outliningChapters: 19,
  planningLessons: 16,
  savingCourseInfo: 1,
  settingUpActivities: 3,
  writingDescription: 3,
};

function getPhaseWeights(kind: FirstActivityKind): Record<PhaseName, number> {
  if (kind === "vocabulary") {
    return {
      ...BASE_PHASE_WEIGHTS,
      addingPronunciation: 12,
      buildingWordList: 10,
      creatingImages: 0,
      finishing: 4,
      preparingVisuals: 0,
      recordingAudio: 20,
      writingContent: 0,
    };
  }

  return {
    ...BASE_PHASE_WEIGHTS,
    addingPronunciation: 0,
    buildingWordList: 0,
    creatingImages: 16,
    finishing: 1,
    preparingVisuals: 8,
    recordingAudio: 0,
    writingContent: 21,
  };
}

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  targetLanguage: string | null,
  startedSteps?: CourseWorkflowStepName[],
): PhaseStatus {
  const kind = getInferredFirstActivityKind(completedSteps, currentStep, targetLanguage);
  return getStatus(phase, completedSteps, currentStep, getPhaseSteps(kind), startedSteps);
}

export function calculateWeightedProgress(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  targetLanguage: string | null,
  startedSteps?: CourseWorkflowStepName[],
): number {
  const kind = getInferredFirstActivityKind(completedSteps, currentStep, targetLanguage);

  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: getPhaseOrder({ completedSteps, currentStep, targetLanguage }),
    phaseSteps: getPhaseSteps(kind),
    phaseWeights: getPhaseWeights(kind),
    startedSteps,
  });
}
