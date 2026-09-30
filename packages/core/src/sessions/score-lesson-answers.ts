import "server-only";
import { prisma } from "@zoonk/db";
import { loadSessionAnswers } from "./_utils/session-answers";
import { STUDY_SESSION_INCLUDE } from "./_utils/study-session-access";
import { type AnswerRecord, classifyAnswers } from "./answer-material";
import { scoreAnswers } from "./brain-power";

type LessonAnswersScore = { brainPower: number; topHyperdrive: number };

/** Every answer given so far in the learner's session; none without one or for someone else's. */
export async function loadStudySessionAnswers({
  studySessionId,
  userId,
}: {
  studySessionId: string | null;
  userId: string;
}) {
  if (!studySessionId) {
    return [];
  }

  const session = await prisma.studySession.findFirst({
    include: STUDY_SESSION_INCLUDE,
    where: { id: studySessionId, userId },
  });

  return session
    ? loadSessionAnswers({ blocks: session.blocks, sessionId: session.id, userId })
    : [];
}

/** The session's Hyperdrive streak before the lesson's first answer. */
async function loadStreakBefore({
  answers,
  studySessionId,
  userId,
}: {
  answers: readonly AnswerRecord[];
  studySessionId: string | null;
  userId: string;
}): Promise<number> {
  const first = answers[0];

  if (!first) {
    return 0;
  }

  const sessionAnswers = await loadStudySessionAnswers({ studySessionId, userId });

  const earlier = sessionAnswers.filter(
    (answer) =>
      answer.answeredAt < first.answeredAt && !answers.some((own) => own.id === answer.id),
  );

  return scoreAnswers({ answers: earlier }).streak;
}

/**
 * Brain Power v2 for a lesson's answers: right answers on questions never answered right before
 * earn points times Hyperdrive (continuing the session's streak when the lesson is one of its
 * blocks), and replayed questions earn less each time. The lesson's completion adds the
 * first-completion bonus (`getOutcomeBonus`) once it knows whether this was a replay.
 *
 * Internal: the lesson player's completion calls it with the lesson's recorded answers, in the
 * order they were given, after deriving `userId` from the session.
 */
export async function scoreLessonAnswers({
  answers,
  studySessionId = null,
  userId,
}: {
  answers: readonly AnswerRecord[];
  studySessionId?: string | null;
  userId: string;
}): Promise<LessonAnswersScore> {
  // Each question counts once, by its first answer: a missed question that comes back at the end
  // of the lesson is practice, not new points.
  const firstAnswers = answers.filter(
    (answer, index) =>
      answers.findIndex(
        (other) => (other.itemId ?? other.stepId) === (answer.itemId ?? answer.stepId),
      ) === index,
  );

  const stepIds = firstAnswers.flatMap((answer) => (answer.stepId ? [answer.stepId] : []));
  const itemIds = firstAnswers.flatMap((answer) => (answer.itemId ? [answer.itemId] : []));

  const [history, streak] = await Promise.all([
    prisma.attempt.findMany({
      select: { answeredAt: true, id: true, isCorrect: true, itemId: true, stepId: true },
      where: {
        OR: [{ stepId: { in: stepIds } }, { itemId: { in: itemIds } }],
        isCorrect: true,
        userId,
      },
    }),
    loadStreakBefore({ answers: firstAnswers, studySessionId, userId }),
  ]);

  const scored = scoreAnswers({
    answers: classifyAnswers({ answers: firstAnswers, dueItemIds: new Set(), history }),
    streak,
  });

  return { brainPower: scored.brainPower, topHyperdrive: scored.topLevel };
}
