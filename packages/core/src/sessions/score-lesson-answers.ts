import "server-only";
import { prisma } from "@zoonk/db";
import { loadSessionAnswers } from "./_utils/session-answers";
import { STUDY_SESSION_INCLUDE } from "./_utils/study-session-access";
import { type AnswerRecord, classifyAnswers } from "./answer-material";
import { scoreAnswers } from "./brain-power";

type LessonAnswersScore = { brainPower: number; topHyperdrive: number };

/** Returns no answers without a session owned by userId. */
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

export type LessonSitting = { startedAt: Date; studySessionId: string | null };

const ONE_SITTING: readonly LessonSitting[] = [{ startedAt: new Date(0), studySessionId: null }];

/** First answers only: repeated questions within a sitting must not earn new-question points. */
function getFirstAnswers(answers: readonly AnswerRecord[]): AnswerRecord[] {
  return answers.filter(
    (answer, index) =>
      answers.findIndex(
        (other) => (other.itemId ?? other.stepId) === (answer.itemId ?? answer.stepId),
      ) === index,
  );
}

function splitBySitting<TAnswer extends AnswerRecord>({
  answers,
  sittings,
}: {
  answers: readonly TAnswer[];
  sittings: readonly LessonSitting[];
}): TAnswer[][] {
  return sittings.map((sitting, index) => {
    const next = sittings[index + 1]?.startedAt;

    return answers.filter(
      (answer) =>
        (index === 0 || answer.answeredAt >= sitting.startedAt) &&
        (!next || answer.answeredAt < next),
    );
  });
}

/** Internal authenticated caller; pass answers and sittings oldest first so streaks cannot carry across days or sessions. */
export async function scoreLessonAnswers({
  answers,
  sittings = ONE_SITTING,
  userId,
}: {
  answers: readonly AnswerRecord[];
  sittings?: readonly LessonSitting[];
  userId: string;
}): Promise<LessonAnswersScore> {
  const firstAnswers = getFirstAnswers(answers);
  const stepIds = firstAnswers.flatMap((answer) => (answer.stepId ? [answer.stepId] : []));
  const itemIds = firstAnswers.flatMap((answer) => (answer.itemId ? [answer.itemId] : []));

  const history = await prisma.attempt.findMany({
    select: { answeredAt: true, id: true, isCorrect: true, itemId: true, stepId: true },
    where: {
      OR: [{ stepId: { in: stepIds } }, { itemId: { in: itemIds } }],
      isCorrect: true,
      userId,
    },
  });

  const classified = classifyAnswers({ answers: firstAnswers, dueItemIds: new Set(), history });
  const bySitting = splitBySitting({ answers: classified, sittings });

  const scores = await Promise.all(
    sittings.map(async (sitting, index) => {
      const sittingAnswers = bySitting[index] ?? [];

      const streak = await loadStreakBefore({
        answers: sittingAnswers,
        studySessionId: sitting.studySessionId,
        userId,
      });

      return scoreAnswers({ answers: sittingAnswers, streak });
    }),
  );

  return {
    brainPower: scores.reduce((total, score) => total + score.brainPower, 0),
    topHyperdrive: Math.max(0, ...scores.map((score) => score.topLevel)),
  };
}
