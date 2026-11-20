import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import {
  type UpcomingChallengeQuestionsRequest,
  requestUpcomingChallengeQuestionsFor,
} from "@zoonk/core/checkpoints/challenge-questions";
import { listListeningPartsToPrepare } from "@zoonk/core/exams/listening/prepare";
import { requestClaimQuestionsFor } from "@zoonk/core/lookahead/claim-questions";
import { requestLessonGenerationFor } from "@zoonk/core/lookahead/request-lesson-generation";
import {
  type GoalPreparationAccess,
  type SessionPreparationAccess,
  getGoalPreparationAccessFor,
  getSessionPreparationAccessFor,
} from "@zoonk/core/lookahead/session-preparation";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type LessonContentInput } from "../../lessons/lesson-content-workflow";
import { requestLiveLessonWriting } from "../../lessons/lesson-writing-request";

/** For a session the learner works on, or for a goal's lessons; `platform` only from a client's ask. */
export type SessionPreparationRequest = { platform?: AnalyticsPlatform | null; userId: string } & (
  | { sessionId: string }
  | { goalId: string; lessonsAskedAt: number | null }
);

export type ClaimQuestions = {
  format: "multipleChoice" | "trueFalse";
  questionsPerSkill: number;
  skillIds: string[];
};

type ChallengeQuestions = Extract<UpcomingChallengeQuestionsRequest, { status: "start" }>;

type Access = GoalPreparationAccess | SessionPreparationAccess;

type ReadyAccess = Extract<Access, { status: "ready" }>;

export type PreparationDecision =
  | { goalId: string; status: "guest"; timeZone: string }
  | { status: "skipped" }
  | {
      challengeQuestions: ChallengeQuestions | null;
      claimQuestions: ClaimQuestions | null;
      goalId: string;
      listening: boolean;
      status: "ready";
      timeZone: string;
    };

async function readClaimQuestions(access: ReadyAccess): Promise<ClaimQuestions | null> {
  const { goalId, userId } = access;
  const { data, error } = await safeAsync(() => requestClaimQuestionsFor({ goalId, userId }));

  if (error) {
    logError(`Could not decide the practice questions of goal ${goalId}.`, error);
    return null;
  }

  return data.status === "start"
    ? { format: data.format, questionsPerSkill: data.questionsPerSkill, skillIds: data.skillIds }
    : null;
}

async function readChallengeQuestions(access: ReadyAccess): Promise<ChallengeQuestions | null> {
  const { goalId, userId } = access;

  const { data, error } = await safeAsync(() =>
    requestUpcomingChallengeQuestionsFor({ goalId, userId }),
  );

  if (error) {
    logError(`Could not decide the challenge questions of goal ${goalId}.`, error);
    return null;
  }

  return data.status === "start" ? data : null;
}

async function hasListeningToPrepare({ goalId, userId }: ReadyAccess): Promise<boolean> {
  const toPrepare = await listListeningPartsToPrepare({ goalId, userId });
  return Boolean(toPrepare && toPrepare.parts.length > 0);
}

export async function requestGuestLessonStep({
  lessonId,
  platform,
  userId,
}: {
  lessonId: string;
  platform: AnalyticsPlatform | null;
  userId: string;
}): Promise<LessonContentInput | null> {
  "use step";

  const writing = await requestLiveLessonWriting({
    lessonId,
    request: () => requestLessonGenerationFor({ lessonId, userId }),
  });

  return writing.status === "start"
    ? {
        analytics: { ...writing.analytics, platform },
        forExam: writing.forExam,
        lessonId,
        wait: "learner",
      }
    : null;
}

function readAccess(request: SessionPreparationRequest): Promise<Access> {
  return "sessionId" in request
    ? getSessionPreparationAccessFor(request)
    : getGoalPreparationAccessFor(request);
}

/**
 * Decides by the learner's id what their write left to prepare. Only a session's preparation
 * writes the questions their claims and the upcoming challenges need.
 */
export async function decidePreparationStep(
  request: SessionPreparationRequest,
): Promise<PreparationDecision> {
  "use step";

  const access = await readAccess(request);

  if (access.status === "guest") {
    return { goalId: access.goalId, status: "guest", timeZone: access.timeZone };
  }

  if (access.status !== "ready") {
    return { status: "skipped" };
  }

  const forSession = "sessionId" in request;

  const [claimQuestions, challengeQuestions, listening] = await Promise.all([
    forSession ? readClaimQuestions(access) : null,
    forSession ? readChallengeQuestions(access) : null,
    hasListeningToPrepare(access),
  ]);

  return {
    challengeQuestions,
    claimQuestions,
    goalId: access.goalId,
    listening,
    status: "ready",
    timeZone: access.timeZone,
  };
}
