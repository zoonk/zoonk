import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { OUTLINE_AHEAD_DAYS, OUTLINE_SOON_DAYS } from "@zoonk/core/lookahead/outline-ahead";
import { type SessionPreparation } from "@zoonk/core/lookahead/session-preparation";
import { getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { type PlanStepOutcome, retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { repeatUntil } from "../_shared/repeat-until";
import { claimRunToken } from "../_shared/run-token";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import { preparePlacementItems, preparePlacementWeekItems } from "../goals/placement-items";
import {
  listLessonFieldItemTargetsStep,
  prepareFieldItemsStep,
  readGoalField,
} from "../goals/steps/field-items-steps";
import {
  listPlanOutlineNeedsStep,
  listSoonStandInCourseIdsStep,
  readPlanFirstSkillStep,
} from "../goals/steps/goal-lookahead-steps";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { prepareLanguageCallsStep } from "./steps/language-call-steps";
import {
  listLearnerVersionTargetsStep,
  prepareFieldChallengeStep,
  prepareToolVersionStep,
} from "./steps/personal-versions-steps";
import {
  countLessonsBeingWrittenStep,
  createSessionGenerationManifestStep,
  listSessionPreparationStep,
} from "./steps/session-preparation-steps";
import { listSkillExtensionsStep } from "./steps/skill-extension-steps";

export type ClaimQuestions = {
  format: "multipleChoice" | "trueFalse";
  questionsPerSkill: number;
  skillIds: string[];
};

export type SessionPreparationInput = {
  claimQuestions?: ClaimQuestions | null;
  goalId: string;
  platform?: AnalyticsPlatform | null;
  timeZone: string;
  userId: string;
};

export type SessionPreparationResult =
  | { laterLessonIds: string[]; lessonIds: string[]; status: "prepared" }
  | { status: "alreadyRunning" };

const WRITING_POLL = "15s";
const MAX_WRITING_POLLS = 40;

async function preparePersonalLayer({
  analytics,
  goalId,
  lessonIds,
}: {
  analytics: ContentAnalytics;
  goalId: string;
  lessonIds: string[];
}) {
  const { workflowRunId } = getWorkflowMetadata();
  const context = { analytics, workflowRunId };
  const field = await readGoalField({ ...context, goalId });

  const [fieldItems, versions] = await Promise.all([
    field ? listLessonFieldItemTargetsStep({ field, lessonIds }) : [],
    listLearnerVersionTargetsStep({ goalId, lessonIds }),
  ]);

  await Promise.allSettled([
    ...fieldItems.map((target) => prepareFieldItemsStep({ ...context, target })),
    ...versions.tools.map((target) => prepareToolVersionStep({ ...context, target })),
    ...versions.challenges.map((target) => prepareFieldChallengeStep({ ...context, target })),
  ]);
}

async function startLessonWork({
  analytics,
  input,
}: {
  analytics: ContentAnalytics;
  input: SessionPreparationInput;
}): Promise<PlanStepOutcome<SessionPreparation | null>> {
  using claim = await claimRunToken(`session-prep:${input.userId}`);

  if (claim.conflict) {
    return { conflict: false, value: null };
  }

  const [preparation, extensions, outlines, soon, firstSkillId] = await Promise.all([
    listSessionPreparationStep(input),
    listSkillExtensionsStep(input),
    listPlanOutlineNeedsStep({ days: OUTLINE_AHEAD_DAYS, goalId: input.goalId }),
    listSoonStandInCourseIdsStep({ days: OUTLINE_SOON_DAYS, goalId: input.goalId }),
    readPlanFirstSkillStep(input.goalId),
  ]);

  const { forExam, laterLessonIds, lessonIds } = preparation;
  const soonCourseIds = new Set(soon);

  const manifest = await createSessionGenerationManifestStep({
    goalId: input.goalId,
    lessonIds: [...lessonIds, ...laterLessonIds],
  });

  if (manifest.conflict) {
    return manifest;
  }

  const planManifest = manifest.value;
  const admitted = new Set(planManifest?.targets.map((target) => target.lessonId));

  await Promise.all([
    ...lessonIds
      .filter((lessonId) => admitted.has(lessonId))
      .map((lessonId) =>
        start(lessonContentWorkflow, [
          { analytics, forExam, lessonId, planGoalId: input.goalId, planManifest },
        ]),
      ),
    ...laterLessonIds
      .filter((lessonId) => admitted.has(lessonId))
      .map((lessonId) =>
        start(lessonContentWorkflow, [
          { analytics, forExam, lessonId, planGoalId: input.goalId, planManifest, wait: "later" },
        ]),
      ),
    ...mergeCourseRequests([...extensions, ...outlines]).map((request) =>
      start(courseOutlineWorkflow, [
        {
          ...request,
          analytics,
          ...getOutlineWait({ courseId: request.courseId, firstSkillId, soonCourseIds }),
        },
      ]),
    ),
  ]);

  return { conflict: false, value: preparation };
}

function getOutlineWait({
  courseId,
  firstSkillId,
  soonCourseIds,
}: {
  courseId: string;
  firstSkillId: string | null;
  soonCourseIds: ReadonlySet<string>;
}): { background: boolean; waitedSkillId?: string } {
  if (!soonCourseIds.has(courseId)) {
    return { background: true };
  }

  return firstSkillId ? { background: false, waitedSkillId: firstSkillId } : { background: false };
}

type CourseRequest = Awaited<ReturnType<typeof listPlanOutlineNeedsStep>>[number];

function mergeCourseRequests(requests: readonly CourseRequest[]): CourseRequest[] {
  return [...Map.groupBy(requests, (request) => request.courseId).values()].flatMap(
    ([first, ...rest]) =>
      first ? [{ ...first, bands: [...first.bands, ...rest.flatMap((item) => item.bands)] }] : [],
  );
}

function waitForWrittenLessons(lessonIds: string[]): Promise<number> {
  if (lessonIds.length === 0) {
    return Promise.resolve(0);
  }

  return repeatUntil({
    done: (writing) => writing === 0,
    run: () => countLessonsBeingWrittenStep(lessonIds),
    times: MAX_WRITING_POLLS,
    wait: () => sleep(WRITING_POLL),
  });
}

async function personalizeLessons({
  analytics,
  input,
  preparation,
}: {
  analytics: ContentAnalytics;
  input: SessionPreparationInput;
  preparation: SessionPreparation;
}) {
  using claim = await claimRunToken(`session-personal:${input.userId}`);

  if (claim.conflict) {
    return;
  }

  await waitForWrittenLessons(preparation.lessonIds);

  await preparePersonalLayer({
    analytics,
    goalId: input.goalId,
    lessonIds: preparation.plannedLessonIds,
  });
}

async function writeClaimQuestions({
  analytics,
  input,
}: {
  analytics: ContentAnalytics;
  input: SessionPreparationInput;
}) {
  const { claimQuestions } = input;

  if (!claimQuestions || claimQuestions.skillIds.length === 0) {
    return;
  }

  const { workflowRunId } = getWorkflowMetadata();

  await preparePlacementItems({
    analytics,
    exceptAnswered: true,
    formats: [claimQuestions.format],
    goalId: input.goalId,
    quickCount: claimQuestions.questionsPerSkill,
    skillIds: claimQuestions.skillIds,
    workflowRunId,
  });
}

async function writePlacementWeekQuestions({
  analytics,
  input,
}: {
  analytics: ContentAnalytics;
  input: SessionPreparationInput;
}) {
  using claim = await claimRunToken(`placement-items:${input.goalId}`);

  if (claim.conflict) {
    return;
  }

  const { workflowRunId } = getWorkflowMetadata();

  await preparePlacementWeekItems({
    analytics,
    goalId: input.goalId,
    timeZone: input.timeZone,
    workflowRunId,
  });
}

export async function sessionPreparationWorkflow(
  input: SessionPreparationInput,
): Promise<SessionPreparationResult> {
  "use workflow";

  const analytics = { distinctId: input.userId, goalId: input.goalId, platform: input.platform };
  const preparation = await retryPlanConflicts(startLessonWork, { analytics, input });

  if (!preparation) {
    return { status: "alreadyRunning" };
  }

  await Promise.all([
    preparation.personalized ? personalizeLessons({ analytics, input, preparation }) : null,
    prepareLanguageCallsStep({ goalId: input.goalId, userId: input.userId }).catch(() => null),
    writeClaimQuestions({ analytics, input }).catch(() => null),
    writePlacementWeekQuestions({ analytics, input }).catch(() => null),
  ]);

  return {
    laterLessonIds: preparation.laterLessonIds,
    lessonIds: preparation.lessonIds,
    status: "prepared",
  };
}
