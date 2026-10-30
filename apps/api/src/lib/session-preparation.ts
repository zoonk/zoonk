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
import { askForLessons, endLessonsAsk } from "@zoonk/core/lookahead/lessons-ask";
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

/** A preparation that never starts can't end its learner's ask, so its request does. */
async function startPreparation<T>({
  goalId,
  lessonsAskedAt,
  run,
}: {
  goalId: string;
  lessonsAskedAt?: number | null;
  run: () => Promise<T>;
}): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (lessonsAskedAt) {
      await endLessonsAsk({ askedAt: lessonsAskedAt, goalId, startedCourseIds: [] });
    }

    throw error;
  }
}

async function startFromAccess({
  access,
  challengeQuestions = null,
  claimQuestions,
  lessonsAskedAt,
  platform,
}: {
  access: ReadyAccess;
  challengeQuestions?: ChallengeQuestions | null;
  claimQuestions: ClaimQuestions | null;
  lessonsAskedAt?: number | null;
  platform: AnalyticsPlatform | null;
}) {
  const [preparation] = await Promise.all([
    startPreparation({
      goalId: access.goalId,
      lessonsAskedAt,
      run: () =>
        start(sessionPreparationWorkflow, [
          {
            claimQuestions,
            goalId: access.goalId,
            lessonsAskedAt,
            platform,
            timeZone: access.timeZone,
            userId: access.userId,
          },
        ]),
    }),
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
  lessonsAskedAt,
  platform,
}: {
  access: GuestAccess;
  lessonsAskedAt?: number | null;
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
      startPreparation({
        goalId,
        lessonsAskedAt,
        run: () =>
          start(guestOutlineWorkflow, [
            { analytics: { distinctId: userId, goalId, platform }, goalId, lessonsAskedAt },
          ]),
      }),
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
    prepareGuestLessons({ access, lessonsAskedAt: await askForLessons({ goalId }), platform });
    return { preparationId: null, status: "started" };
  }

  if (access.status === "plusRequired") {
    return { preparationId: null, status: "started" };
  }

  if (access.status !== "ready") {
    return access;
  }

  const lessonsAskedAt = await askForLessons({ goalId });

  return startFromAccess({ access, claimQuestions: null, lessonsAskedAt, platform });
}

/** Starts after the response is sent; a failure is logged, and the next block prepares again. */
export async function scheduleGoalPreparation(goalId: string): Promise<void> {
  const [access, platform] = await Promise.all([
    getGoalPreparationAccess({ goalId }),
    getRequestPlatform(),
  ]);

  if (access.status === "guest") {
    prepareGuestLessons({ access, lessonsAskedAt: await askForLessons({ goalId }), platform });
    return;
  }

  if (access.status !== "ready") {
    return;
  }

  const lessonsAskedAt = await askForLessons({ goalId });

  after(async () => {
    const { error } = await safeAsync(() =>
      startFromAccess({ access, claimQuestions: null, lessonsAskedAt, platform }),
    );

    if (error) {
      logError(`Could not start preparing goal ${goalId}'s first lessons.`, error);
    }
  });
}
