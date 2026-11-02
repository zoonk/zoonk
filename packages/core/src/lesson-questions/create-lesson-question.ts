import "server-only";
import { type LessonQuestionContextSnapshot } from "@zoonk/ai/tasks/lessons/question-context";
import { prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { type MissionMomentView } from "../sessions/completion-contract";
import { saveDayBeforeActivity } from "../sessions/ensure-study-session";
import { loadMissionMoment } from "../sessions/missions/mission-moment";
import { settleLearnerMissions } from "../sessions/missions/settle-learner-missions";
import { getSession } from "../users/get-session";
import { toDatabaseLessonQuestionContextSnapshot } from "./_utils/context-snapshot-schema";
import {
  type LessonQuestionResourceSource,
  lessonQuestionResourceOmit,
  lessonQuestionResourceQuery,
  markItemTurnAnswered,
  toLessonQuestionResource,
} from "./_utils/question-resource";
import { getLessonQuestionRequestFingerprint } from "./_utils/request-fingerprint";
import { lockLessonQuestionThread } from "./_utils/thread-lock";
import { buildTutorContextSnapshot } from "./_utils/tutor-context-snapshot";
import { getTutorAskedEvent } from "./_utils/tutor-events";
import {
  type TutorSubject,
  findTutorSubject,
  getSubjectThreadColumn,
} from "./_utils/tutor-subject";
import {
  type CreateLessonQuestionInput,
  type LessonScreenSuggestion,
  type TutorTarget,
} from "./contract";

type WordSuggestion = (input: {
  language: string;
  suggestion: LessonScreenSuggestion;
}) => Promise<string>;

type AskedQuestion = { question: string; suggestion: LessonScreenSuggestion | null };

async function settleAskedQuestion({
  questionId,
  userId,
}: {
  questionId: string;
  userId: string;
}): Promise<MissionMomentView | null> {
  const timeZone = await getLearnerTimeZone({ userId });
  const source = { id: questionId, kind: "buddyQuestion" };

  await settleLearnerMissions({ source, timeZone, userId });
  return loadMissionMoment({ source, timeZone, userId });
}

type PersistedQuestionOutcome = Awaited<ReturnType<typeof getCreateLessonQuestionOutcome>>;

async function finishCreatedQuestion({
  outcome,
  userId,
}: {
  outcome: PersistedQuestionOutcome;
  userId: string;
}) {
  if (outcome.status !== "created") {
    return outcome;
  }

  const [question, missionMoment] = await Promise.all([
    markItemTurnAnswered({ question: outcome.question }),
    settleAskedQuestion({ questionId: outcome.question.id, userId }),
  ]);

  return { missionMoment, question, status: outcome.status };
}

async function getCreateLessonQuestionOutcome({
  question,
  requestFingerprint,
}: {
  question: LessonQuestionResourceSource;
  requestFingerprint: string;
}) {
  if (question.requestFingerprint !== requestFingerprint) {
    return { status: "conflict" as const };
  }

  return { question: await toLessonQuestionResource(question), status: "created" as const };
}

function findExistingLessonQuestion({
  requestId,
  subject,
  userId,
}: {
  requestId: string;
  subject: TutorSubject;
  userId: string;
}) {
  return prisma.lessonQuestion.findFirst({
    ...lessonQuestionResourceQuery,
    where: { requestId, thread: { ...getSubjectThreadColumn(subject), userId } },
  });
}

async function persistLessonQuestion({
  asked,
  contextSnapshot,
  goalId,
  input,
  requestFingerprint,
  stepId,
  stepNumber,
  subject,
  userId,
}: {
  asked: AskedQuestion;
  contextSnapshot: LessonQuestionContextSnapshot;
  /** The goal whose plan the snapshot holds; null without one. */
  goalId: string | null;
  input: CreateLessonQuestionInput;
  requestFingerprint: string;
  stepId: string | null;
  stepNumber: number | null;
  subject: TutorSubject;
  userId: string;
}) {
  const threadWhere = { ...getSubjectThreadColumn(subject), userId };

  return writeLearnerChange<PersistedQuestionOutcome>({ userId }, async (transaction) => {
    await transaction.lessonQuestionThread.createMany({
      data: [{ ...threadWhere, kind: subject.kind }],
      skipDuplicates: true,
    });

    const thread = await transaction.lessonQuestionThread.findFirstOrThrow({ where: threadWhere });

    await lockLessonQuestionThread({ threadId: thread.id, transaction });

    const existingQuestion = await transaction.lessonQuestion.findUnique({
      ...lessonQuestionResourceQuery,
      where: { threadLessonQuestionRequest: { requestId: input.requestId, threadId: thread.id } },
    });

    if (existingQuestion) {
      return unchanged(
        await getCreateLessonQuestionOutcome({ question: existingQuestion, requestFingerprint }),
      );
    }

    const unfinishedQuestion = await transaction.lessonQuestion.findFirst({
      omit: lessonQuestionResourceOmit,
      where: { libraryStepId: stepId, status: { not: "completed" }, threadId: thread.id },
    });

    if (unfinishedQuestion) {
      return unchanged({ status: "conflict" });
    }

    const [created] = await Promise.all([
      transaction.lessonQuestion.create({
        data: {
          contextKind: input.context.kind,
          contextSnapshot: toDatabaseLessonQuestionContextSnapshot(contextSnapshot),
          goalId,
          libraryStepId: stepId,
          question: asked.question,
          requestFingerprint,
          requestId: input.requestId,
          stepNumber,
          suggestion: asked.suggestion,
          threadId: thread.id,
        },
        omit: lessonQuestionResourceOmit,
      }),
      transaction.lessonQuestionThread.update({
        data: { updatedAt: new Date() },
        where: { id: thread.id },
      }),
    ]);

    after(() => trackLearnerEvents({ events: [getTutorAskedEvent({ input, subject })], userId }));

    return getCreateLessonQuestionOutcome({ question: created, requestFingerprint });
  });
}

/** Ignore client text for recognized suggestions so private learner words can never enter a shared answer. */
async function toAskedQuestion({
  input,
  language,
  wordSuggestion,
}: {
  input: CreateLessonQuestionInput;
  language: string;
  wordSuggestion?: WordSuggestion;
}): Promise<AskedQuestion> {
  if (!input.suggestion || !wordSuggestion) {
    return { question: input.question, suggestion: null };
  }

  return {
    question: await wordSuggestion({ language, suggestion: input.suggestion }),
    suggestion: input.suggestion,
  };
}

/** Requires a learner session and current subject access; builds all content-bearing context on the server. */
export async function createLessonQuestion({
  input,
  target,
  wordSuggestion,
}: {
  input: CreateLessonQuestionInput;
  target: TutorTarget;
  /** Without a suggestion translator, supplied text remains a personal question. */
  wordSuggestion?: WordSuggestion;
}) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const userId = session.user.id;
  const access = await findTutorSubject({ target, userId });

  if (access.status !== "ready") {
    return access;
  }

  const { subject } = access;
  const requestFingerprint = getLessonQuestionRequestFingerprint(input);

  const existingQuestion = await findExistingLessonQuestion({
    requestId: input.requestId,
    subject,
    userId,
  });

  if (existingQuestion) {
    return finishCreatedQuestion({
      outcome: await getCreateLessonQuestionOutcome({
        question: existingQuestion,
        requestFingerprint,
      }),
      userId,
    });
  }

  // Save the offered day before a question can complete one of its missions.
  await saveDayBeforeActivity({ userId });

  const [context, asked] = await Promise.all([
    buildTutorContextSnapshot({ context: input.context, subject, userId }),
    toAskedQuestion({ input, language: subject.language, wordSuggestion }),
  ]);

  if (context.status !== "ready") {
    return context;
  }

  const outcome = await persistLessonQuestion({
    asked,
    contextSnapshot: context.contextSnapshot,
    goalId: context.goalId,
    input,
    requestFingerprint,
    stepId: context.stepId,
    stepNumber: context.stepNumber,
    subject,
    userId,
  });

  return finishCreatedQuestion({ outcome, userId });
}
