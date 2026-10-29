import "server-only";
import { startLearnerListeningSets } from "@/lib/learner-listening-sets";
import { scheduleLessonWriting } from "@/lib/lesson-writing";
import { challengeQuestionsWorkflow } from "@/workflows/v2/goals/challenge-questions-workflow";
import { guestOutlineWorkflow } from "@/workflows/v2/sessions/guest-outline-workflow";
import {
  type ClaimQuestions,
  sessionPreparationWorkflow,
} from "@/workflows/v2/sessions/session-preparation-workflow";
import { getRequestPlatform } from "@zoonk/core/analytics/request-platform";
import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import {
  type UpcomingChallengeQuestionsRequest,
  requestUpcomingChallengeQuestions,
} from "@zoonk/core/checkpoints/challenge-questions";
import { requestClaimQuestions } from "@zoonk/core/lookahead/claim-questions";
import {
  type GoalPreparationAccess,
  type SessionPreparationAccess,
  getGoalPreparationAccess,
  getSessionPreparationAccess,
} from "@zoonk/core/lookahead/session-preparation";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { after } from "next/server";
import { start } from "workflow/api";

type ReadyAccess = Pick<
  Extract<GoalPreparationAccess | SessionPreparationAccess, { status: "ready" }>,
  "goalId" | "timeZone" | "userId"
>;

type GuestAccess = Extract<SessionPreparationAccess, { status: "guest" }>;

type SessionPreparationStart =
  | { preparationId: string | null; status: "started" }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function readClaimQuestions(goalId: string): Promise<ClaimQuestions | null> {
  const { data, error } = await safeAsync(() => requestClaimQuestions({ goalId }));

  if (error) {
    logError(`Could not decide the practice questions of goal ${goalId}.`, error);
    return null;
  }

  return data.status === "start"
    ? { format: data.format, questionsPerSkill: data.questionsPerSkill, skillIds: data.skillIds }
    : null;
}

type ChallengeQuestions = Extract<UpcomingChallengeQuestionsRequest, { status: "start" }>;

async function readChallengeQuestions(goalId: string): Promise<ChallengeQuestions | null> {
  const { data, error } = await safeAsync(() => requestUpcomingChallengeQuestions({ goalId }));

  if (error) {
    logError(`Could not decide the challenge questions of goal ${goalId}.`, error);
    return null;
  }

  return data.status === "start" ? data : null;
}

function startChallengeQuestions(request: ChallengeQuestions | null) {
  if (!request) {
    return [];
  }

  const { analytics, challenges, quickFormat } = request;

  return challenges.map(({ key, later, writes }) =>
    start(challengeQuestionsWorkflow, [
      { analytics, goalId: analytics.goalId, key, later, quickFormat, writes },
    ]),
  );
}

async function startFromAccess({
  access,
  challengeQuestions = null,
  claimQuestions,
  platform,
}: {
  access: ReadyAccess;
  challengeQuestions?: ChallengeQuestions | null;
  claimQuestions: ClaimQuestions | null;
  platform: AnalyticsPlatform | null;
}) {
  const [preparation] = await Promise.all([
    start(sessionPreparationWorkflow, [
      {
        claimQuestions,
        goalId: access.goalId,
        platform,
        timeZone: access.timeZone,
        userId: access.userId,
      },
    ]),
    startLearnerListeningSets({
      analytics: { distinctId: access.userId, goalId: access.goalId, platform },
      goalId: access.goalId,
      userId: access.userId,
    }),
    ...startChallengeQuestions(challengeQuestions),
  ]);

  return { preparationId: preparation.runId, status: "started" as const };
}

/** A placement or a plan edit can move a guest's plan past the bands its build outlined. */
function prepareGuestLessons({
  access,
  platform,
}: {
  access: GuestAccess;
  platform: AnalyticsPlatform | null;
}) {
  const { goalId, lessonId, userId } = access;

  if (lessonId) {
    scheduleLessonWriting(lessonId);
  }

  if (!goalId) {
    return;
  }

  after(async () => {
    const { error } = await safeAsync(() =>
      start(guestOutlineWorkflow, [
        { analytics: { distinctId: userId, goalId, platform }, goalId },
      ]),
    );

    if (error) {
      logError(`Could not start outlining guest goal ${goalId}'s next lessons.`, error);
    }
  });
}

export async function startSessionPreparation({
  sessionId,
}: {
  sessionId: string;
}): Promise<SessionPreparationStart> {
  const [access, platform] = await Promise.all([
    getSessionPreparationAccess({ sessionId }),
    getRequestPlatform(),
  ]);

  if (access.status === "guest") {
    prepareGuestLessons({ access, platform });
    return { preparationId: null, status: "started" };
  }

  if (access.status === "plusRequired") {
    return { preparationId: null, status: "started" };
  }

  if (access.status !== "ready") {
    return access;
  }

  const [claimQuestions, challengeQuestions] = await Promise.all([
    readClaimQuestions(access.goalId),
    readChallengeQuestions(access.goalId),
  ]);

  return startFromAccess({ access, challengeQuestions, claimQuestions, platform });
}

/** Starts after the response is sent; a failure is logged, and the next block prepares again. */
export async function scheduleSessionPreparation(sessionId: string): Promise<void> {
  const [access, platform] = await Promise.all([
    getSessionPreparationAccess({ sessionId }),
    getRequestPlatform(),
  ]);

  if (access.status === "guest") {
    prepareGuestLessons({ access, platform });
    return;
  }

  if (access.status !== "ready") {
    return;
  }

  const [claimQuestions, challengeQuestions] = await Promise.all([
    readClaimQuestions(access.goalId),
    readChallengeQuestions(access.goalId),
  ]);

  after(async () => {
    const { error } = await safeAsync(() =>
      startFromAccess({ access, challengeQuestions, claimQuestions, platform }),
    );

    if (error) {
      logError(`Could not start preparing around study session ${sessionId}.`, error);
    }
  });
}

export async function startGoalPreparation({
  goalId,
}: {
  goalId: string;
}): Promise<SessionPreparationStart> {
  const [access, platform] = await Promise.all([
    getGoalPreparationAccess({ goalId }),
    getRequestPlatform(),
  ]);

  if (access.status === "guest") {
    prepareGuestLessons({ access, platform });
    return { preparationId: null, status: "started" };
  }

  if (access.status === "plusRequired") {
    return { preparationId: null, status: "started" };
  }

  if (access.status !== "ready") {
    return access;
  }

  return startFromAccess({ access, claimQuestions: null, platform });
}

/** Starts after the response is sent; a failure is logged, and the next block prepares again. */
export async function scheduleGoalPreparation(goalId: string): Promise<void> {
  const [access, platform] = await Promise.all([
    getGoalPreparationAccess({ goalId }),
    getRequestPlatform(),
  ]);

  if (access.status === "guest") {
    prepareGuestLessons({ access, platform });
    return;
  }

  if (access.status !== "ready") {
    return;
  }

  after(async () => {
    const { error } = await safeAsync(() =>
      startFromAccess({ access, claimQuestions: null, platform }),
    );

    if (error) {
      logError(`Could not start preparing goal ${goalId}'s first lessons.`, error);
    }
  });
}
