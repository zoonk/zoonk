import { startListeningSets } from "@/lib/listening-sets";
import { type SessionPreparation } from "@zoonk/core/lookahead/session-preparation";
import { getWorkflowMetadata, sleep } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { claimRunToken } from "../_shared/run-token";
import { whileLessonsAsked } from "../goals/goal-outlines";
import { preparePlacementItems, preparePlacementWeekItems } from "../goals/placement-items";
import {
  listLessonFieldItemTargetsStep,
  prepareSkillFieldItems,
  readGoalField,
} from "../goals/steps/field-items-steps";
import { endLessonsAskStep } from "../goals/steps/goal-lookahead-steps";
import { startChallengeQuestions } from "./challenge-question-starts";
import { prepareFieldChallenge } from "./prepare-field-challenge";
import { type PlanLessonPreparationInput, outlineAndReselect } from "./prepare-plan-lessons";
import { prepareToolVersion } from "./prepare-tool-version";
import { writeLanguageCalls } from "./steps/language-call-steps";
import { listLearnerVersionTargetsStep } from "./steps/personal-versions-steps";
import {
  type ClaimQuestions,
  type SessionPreparationRequest,
  decidePreparationStep,
} from "./steps/preparation-decision-step";
import { countLessonsBeingWrittenStep } from "./steps/session-preparation-steps";

type SessionPreparationInput = PlanLessonPreparationInput & {
  claimQuestions: ClaimQuestions | null;
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
    ...fieldItems.map((target) => prepareSkillFieldItems({ ...context, target })),
    ...versions.tools.map((target) => prepareToolVersion({ ...context, target })),
    ...versions.challenges.map((target) => prepareFieldChallenge({ ...context, target })),
  ]);
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
    run: (started) => outlineAndReselect({ analytics, input, started }),
  });

  if (!preparation) {
    return { status: "alreadyRunning" };
  }

  if (input.guest) {
    return { status: "guest" };
  }

  await Promise.all([
    preparation.personalized ? personalizeLessons({ analytics, input, preparation }) : null,
    writeLanguageCalls({ goalId: input.goalId, userId: input.userId }).catch(() => null),
    writeClaimQuestions({ analytics, input }).catch(() => null),
    writePlacementWeekQuestions({ analytics, input }).catch(() => null),
  ]);

  return {
    laterLessonIds: preparation.laterLessonIds,
    lessonIds: preparation.lessonIds,
    status: "prepared",
  };
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

  const { goalId } = decision;
  const analytics = { distinctId: userId, goalId, platform };

  if (decision.status === "ready") {
    await Promise.allSettled([
      decision.listening ? startListeningSets({ analytics, goalId, userId, wait: "later" }) : null,
      ...startChallengeQuestions(decision),
    ]);
  }

  return prepareLessons({
    analytics,
    input: {
      claimQuestions: decision.status === "ready" ? decision.claimQuestions : null,
      goalId,
      guest: decision.status === "guest",
      lessonsAskedAt,
      timeZone: decision.timeZone,
      userId,
    },
  });
}
