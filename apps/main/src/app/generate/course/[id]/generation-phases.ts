import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  calculateTargetProgress as calculateTarget,
  getActivePhaseDurationMs as getDuration,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { type CourseStepName, type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import {
  CheckCircleIcon,
  ImageIcon,
  LayoutListIcon,
  type LucideIcon,
  PenLineIcon,
  SearchIcon,
  SettingsIcon,
  TagIcon,
} from "lucide-react";

export type PhaseName =
  | "gettingReady"
  | "findingSimilarCourses"
  | "checkingCourseIdentity"
  | "preparingCourse"
  | "planningIntroduction"
  | "savingIntroduction"
  | "writingFirstLesson"
  | "writingDescription"
  | "creatingCoverImage"
  | "categorizingCourse"
  | "outliningChapters"
  | "writingLandingPage"
  | "savingCourseInfo";

/**
 * Keep each AI generation task in its own phase. These phases drive the
 * thinking messages users see, so grouping model calls hides what the workflow
 * is generating right now.
 */
const PHASE_STEPS = {
  categorizingCourse: ["generateCategories"],
  checkingCourseIdentity: ["resolveCourseIdentity"],
  creatingCoverImage: ["generateImage"],
  findingSimilarCourses: ["generateCourseIdentitySearchQueries"],
  gettingReady: ["getCoursePrompt"],
  outliningChapters: ["generateChapters"],
  planningIntroduction: ["generateIntroductionChapter"],
  preparingCourse: ["initializeCourse", "setCourseAsRunning"],
  savingCourseInfo: [
    "getExistingChapters",
    "updateCourse",
    "addCategories",
    "addChapters",
    "completeCourseSetup",
  ],
  savingIntroduction: ["addIntroductionChapter", "getChapter", "addLessons"],
  writingDescription: ["generateDescription"],
  writingFirstLesson: [
    "getLesson",
    "setLessonAsRunning",
    "generateExplanationContent",
    "generateImagePrompts",
    "generateStepImages",
    "generateLessonImage",
    "saveExplanationLesson",
    "setLessonAsCompleted",
    "completeIntroductionLesson",
  ],
  writingLandingPage: ["generateLandingPage"],
} as const satisfies Record<PhaseName, readonly CourseWorkflowStepName[]>;

type AssignedSteps = (typeof PHASE_STEPS)[PhaseName][number];
type _ValidateCourse = AssertAllCovered<Exclude<CourseStepName, AssignedSteps>>;

const PHASE_ORDER: PhaseName[] = [
  "gettingReady",
  "findingSimilarCourses",
  "checkingCourseIdentity",
  "preparingCourse",
  "planningIntroduction",
  "savingIntroduction",
  "writingFirstLesson",
  "writingDescription",
  "creatingCoverImage",
  "categorizingCourse",
  "outliningChapters",
  "writingLandingPage",
  "savingCourseInfo",
];

const INTRODUCTION_PHASES = new Set<PhaseName>([
  "planningIntroduction",
  "savingIntroduction",
  "writingFirstLesson",
]);

const NON_LANGUAGE_COURSE_PHASES = [
  "gettingReady",
  "findingSimilarCourses",
  "checkingCourseIdentity",
  "preparingCourse",
  "planningIntroduction",
  "savingIntroduction",
  "writingFirstLesson",
] satisfies PhaseName[];

/**
 * Chooses the visible timeline for the two course setup paths. Regular courses
 * redirect once the first intro lesson is ready, so showing later course setup
 * phases would make the progress UI describe work the learner no longer waits
 * for. Language courses keep the older full-course setup timeline, minus the
 * intro phases that only exist for regular courses.
 */
export function getPhaseOrder({
  isLanguageCourse = false,
}: { isLanguageCourse?: boolean } = {}): PhaseName[] {
  if (isLanguageCourse) {
    return PHASE_ORDER.filter((phase) => !INTRODUCTION_PHASES.has(phase));
  }

  return [...NON_LANGUAGE_COURSE_PHASES];
}

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  categorizingCourse: TagIcon,
  checkingCourseIdentity: CheckCircleIcon,
  creatingCoverImage: ImageIcon,
  findingSimilarCourses: SearchIcon,
  gettingReady: SettingsIcon,
  outliningChapters: LayoutListIcon,
  planningIntroduction: PenLineIcon,
  preparingCourse: SettingsIcon,
  savingCourseInfo: CheckCircleIcon,
  savingIntroduction: LayoutListIcon,
  writingDescription: PenLineIcon,
  writingFirstLesson: PenLineIcon,
  writingLandingPage: PenLineIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  categorizingCourse: 2,
  checkingCourseIdentity: 2,
  creatingCoverImage: 20,
  findingSimilarCourses: 2,
  gettingReady: 1,
  outliningChapters: 102,
  planningIntroduction: 8,
  preparingCourse: 1,
  savingCourseInfo: 1,
  savingIntroduction: 1,
  writingDescription: 4,
  writingFirstLesson: 60,
  writingLandingPage: 8,
};

export function getActivePhaseDurationMs(activePhaseNames: PhaseName[]): number | undefined {
  return getDuration({ activePhases: activePhaseNames, phaseWeights: PHASE_WEIGHTS });
}

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  startedSteps?: CourseWorkflowStepName[],
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS, startedSteps);
}

const PROGRESS_CONFIG = {
  phaseOrder: PHASE_ORDER,
  phaseSteps: PHASE_STEPS,
  phaseWeights: PHASE_WEIGHTS,
};

/**
 * Reuses the same step assignments and weights while narrowing the ordered
 * phase list to the course family the learner is waiting on.
 */
function getProgressConfig({ isLanguageCourse }: { isLanguageCourse: boolean }) {
  return { ...PROGRESS_CONFIG, phaseOrder: getPhaseOrder({ isLanguageCourse }) };
}

export function calculateWeightedProgress(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  startedSteps?: CourseWorkflowStepName[],
  isLanguageCourse = false,
): number {
  return calculateProgress(completedSteps, currentStep, {
    ...getProgressConfig({ isLanguageCourse }),
    startedSteps,
  });
}

export function calculateTargetProgress(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  startedSteps?: CourseWorkflowStepName[],
  isLanguageCourse = false,
): number {
  return calculateTarget(completedSteps, currentStep, {
    ...getProgressConfig({ isLanguageCourse }),
    startedSteps,
  });
}
