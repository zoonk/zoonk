import { startListeningSets } from "@/lib/listening-sets";
import { OUTLINE_AHEAD_DAYS } from "@zoonk/core/lookahead/outline-ahead";
import { type SessionPreparation } from "@zoonk/core/lookahead/session-preparation";
import { getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { type PlanStepOutcome, retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { repeatUntil } from "../_shared/repeat-until";
import { claimRunToken } from "../_shared/run-token";
import { challengeQuestionsWorkflow } from "../goals/challenge-questions-workflow";
import {
  listPlanOutlines,
  startAll,
  startPlanOutline,
  whileLessonsAsked,
} from "../goals/goal-outlines";
import { preparePlacementItems, preparePlacementWeekItems } from "../goals/placement-items";
import {
  listLessonFieldItemTargetsStep,
  prepareFieldItemsStep,
  readGoalField,
} from "../goals/steps/field-items-steps";
import { endLessonsAskStep, readGoalLookaheadStep } from "../goals/steps/goal-lookahead-steps";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { prepareLanguageCallsStep } from "./steps/language-call-steps";
import {
  listLearnerVersionTargetsStep,
  prepareFieldChallengeStep,
  prepareToolVersionStep,
} from "./steps/personal-versions-steps";
import {
  type ClaimQuestions,
  type PreparationDecision,
  type SessionPreparationRequest,
  decidePreparationStep,
} from "./steps/preparation-decision-step";
import {
  countLessonsBeingWrittenStep,
  createSessionGenerationManifestStep,
  listSessionPreparationStep,
} from "./steps/session-preparation-steps";

type SessionPreparationInput = {
  claimQuestions: ClaimQuestions | null;
  goalId: string;
  lessonsAskedAt: number | null;
  timeZone: string;
  userId: string;
};

export type SessionPreparationResult =
  | { laterLessonIds: string[]; lessonIds: string[]; status: "prepared" }
  | { status: "alreadyRunning" | "guest" | "skipped" };

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
  started,
}: {
  analytics: ContentAnalytics;
  input: SessionPreparationInput;
  started: string[];
}): Promise<PlanStepOutcome<SessionPreparation | null>> {
  using claim = await claimRunToken(`session-prep:${input.userId}`);

  // The learner's own ask waits for their other preparation instead of being dropped.
  if (claim.conflict) {
    return input.lessonsAskedAt ? { conflict: true } : { conflict: false, value: null };
  }

  const [preparation, outlines] = await Promise.all([
    listSessionPreparationStep(input),
    listPlanOutlines({ days: OUTLINE_AHEAD_DAYS, goalId: input.goalId }),
  ]);

  const { forExam, laterLessonIds, lessonIds } = preparation;

  const manifest = await createSessionGenerationManifestStep({
    goalId: input.goalId,
    lessonIds: [...lessonIds, ...laterLessonIds],
  });

  if (manifest.conflict) {
    return manifest;
  }

  const planManifest = manifest.value;
  const admitted = new Set(planManifest?.targets.map((target) => target.lessonId));

  await startAll([
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
    ...outlines.map((outline) => startPlanOutline({ analytics, outline, started })),
  ]);

  return { conflict: false, value: preparation };
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

async function prepareLessons({
  analytics,
  input,
}: {
  analytics: ContentAnalytics;
  input: SessionPreparationInput;
}): Promise<SessionPreparationResult> {
  const preparation = await whileLessonsAsked({
    goalId: input.goalId,
    lessonsAskedAt: input.lessonsAskedAt,
    run: (started) => retryPlanConflicts(startLessonWork, { analytics, input, started }),
  });

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

/** A placement or a plan edit can move a guest's plan past the bands its build outlined. */
async function outlineGuestLessons({
  analytics,
  goalId,
  lessonsAskedAt,
}: {
  analytics: ContentAnalytics;
  goalId: string;
  lessonsAskedAt: number | null;
}) {
  await whileLessonsAsked({
    goalId,
    lessonsAskedAt,
    run: async (started) => {
      const { outlineDays } = await readGoalLookaheadStep(goalId);
      const outlines = await listPlanOutlines({ days: outlineDays, goalId });

      await startAll(
        outlines.map((outline) =>
          startPlanOutline({ analytics, forGuest: true, outline, started }),
        ),
      );
    },
  });
}

function startChallengeQuestions(decision: Extract<PreparationDecision, { status: "ready" }>) {
  const request = decision.challengeQuestions;

  if (!request) {
    return [];
  }

  const { analytics, challenges, quickFormat } = request;

  return challenges.map(({ key, later, writes }) =>
    start(challengeQuestionsWorkflow, [
      { analytics, goalId: decision.goalId, key, later, quickFormat, writes },
    ]),
  );
}

export async function sessionPreparationWorkflow(
  request: SessionPreparationRequest,
): Promise<SessionPreparationResult> {
  "use workflow";

  const { platform, userId } = request;
  const lessonsAskedAt = "goalId" in request ? request.lessonsAskedAt : null;
  const decision = await decidePreparationStep(request);

  if (decision.status === "skipped") {
    if ("goalId" in request && lessonsAskedAt) {
      await endLessonsAskStep({
        askedAt: lessonsAskedAt,
        goalId: request.goalId,
        startedCourseIds: [],
      });
    }

    return { status: "skipped" };
  }

  if (decision.status === "guest") {
    const { goalId, lesson } = decision;
    const analytics = { distinctId: userId, goalId: goalId ?? undefined, platform };

    await Promise.all([
      lesson ? start(lessonContentWorkflow, [lesson]) : null,
      goalId ? outlineGuestLessons({ analytics, goalId, lessonsAskedAt }) : null,
    ]);

    return { status: "guest" };
  }

  const { goalId } = decision;
  const analytics = { distinctId: userId, goalId, platform };

  await Promise.allSettled([
    decision.listening ? startListeningSets({ analytics, goalId, userId, wait: "later" }) : null,
    ...startChallengeQuestions(decision),
  ]);

  return prepareLessons({
    analytics,
    input: {
      claimQuestions: decision.claimQuestions,
      goalId,
      lessonsAskedAt,
      timeZone: decision.timeZone,
      userId,
    },
  });
}
