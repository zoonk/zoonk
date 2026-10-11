import "server-only";
import { startLearnerListeningSets } from "@/lib/learner-listening-sets";
import { scheduleLessonWriting } from "@/lib/lesson-writing";
import { challengeQuestionsWorkflow } from "@/workflows/v2/goals/challenge-questions-workflow";
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

/**
 * Questions for the topics the learner was taken to know that practice has none to ask yet (see
 * `requestClaimQuestions`), decided while the request is still here; none when there are none to
 * write, the learner's AI help allowance doesn't cover them, or deciding fails.
 */
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

/**
 * The questions of challenges coming up soon that the bank is short of (see
 * `requestUpcomingChallengeQuestions`), decided while the request is still here; none when there
 * are none to write, the learner's AI help allowance doesn't cover them, or deciding fails.
 */
async function readChallengeQuestions(goalId: string): Promise<ChallengeQuestions | null> {
  const { data, error } = await safeAsync(() => requestUpcomingChallengeQuestions({ goalId }));

  if (error) {
    logError(`Could not decide the challenge questions of goal ${goalId}.`, error);
    return null;
  }

  return data.status === "start" ? data : null;
}

/** One run per challenge, each joining a run that already writes the same skills' questions. */
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

/**
 * `platform` is the client whose request started the work, which the preparation carries. A
 * learner who heard every listening recording of a part also gets its next one made, and the
 * challenges coming up soon get the questions they lack.
 */
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

/**
 * A guest gets only the lesson they reach next written ahead, counted as its start like opening
 * it, so the day's first lesson isn't written only once they reach it; nothing else is prepared.
 */
function writeGuestNextLesson(access: GuestAccess) {
  if (access.lessonId) {
    scheduleLessonWriting(access.lessonId);
  }
}

/**
 * Starts getting a study session's lessons ready: whenever a block starts and when the session
 * ends, the rest of today's lessons and the next study day's get written. A guest gets only the
 * next lesson (`writeGuestNextLesson`), and a free exam plan past its first week nothing, since
 * its new lessons come with Plus.
 */
export async function startSessionPreparation({
  sessionId,
}: {
  sessionId: string;
}): Promise<SessionPreparationStart> {
  const access = await getSessionPreparationAccess({ sessionId });

  if (access.status === "guest") {
    writeGuestNextLesson(access);
    return { preparationId: null, status: "started" };
  }

  if (access.status === "plusRequired") {
    return { preparationId: null, status: "started" };
  }

  if (access.status !== "ready") {
    return access;
  }

  const [claimQuestions, challengeQuestions, platform] = await Promise.all([
    readClaimQuestions(access.goalId),
    readChallengeQuestions(access.goalId),
    getRequestPlatform(),
  ]);

  return startFromAccess({ access, challengeQuestions, claimQuestions, platform });
}

/**
 * For session routes whose answer shouldn't wait on preparation: access and the client are read
 * from the request, and the run starts after the response is sent. A failure is logged; the next
 * block the learner starts prepares again.
 */
export async function scheduleSessionPreparation(sessionId: string): Promise<void> {
  const [access, platform] = await Promise.all([
    getSessionPreparationAccess({ sessionId }),
    getRequestPlatform(),
  ]);

  if (access.status === "guest") {
    writeGuestNextLesson(access);
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

/**
 * Starts getting a goal's first lessons ready before its first session is built, right after
 * placement: today's first lessons and the next study day's, as a session's preparation writes
 * them. A guest gets only the plan's first lesson (`writeGuestNextLesson`).
 */
export async function startGoalPreparation({
  goalId,
}: {
  goalId: string;
}): Promise<SessionPreparationStart> {
  const access = await getGoalPreparationAccess({ goalId });

  if (access.status === "guest") {
    writeGuestNextLesson(access);
    return { preparationId: null, status: "started" };
  }

  if (access.status === "plusRequired") {
    return { preparationId: null, status: "started" };
  }

  if (access.status !== "ready") {
    return access;
  }

  return startFromAccess({ access, claimQuestions: null, platform: await getRequestPlatform() });
}

/**
 * For routes whose answer shouldn't wait on it, such as placement's completion or a plan change:
 * the goal's next lessons, and the outlines of the topics it has soon, start being written after
 * the response is sent. A failure is logged; the next block the learner opens prepares again.
 */
export async function scheduleGoalPreparation(goalId: string): Promise<void> {
  const [access, platform] = await Promise.all([
    getGoalPreparationAccess({ goalId }),
    getRequestPlatform(),
  ]);

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
