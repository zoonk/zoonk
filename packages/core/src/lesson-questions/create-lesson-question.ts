import "server-only";
import { type LessonQuestionContextSnapshot } from "@zoonk/ai/tasks/lessons/question-context";
import { prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { getSession } from "../users/get-session";
import { toDatabaseLessonQuestionContextSnapshot } from "./_utils/context-snapshot-schema";
import {
  type LessonQuestionResourceSource,
  lessonQuestionResourceOmit,
  lessonQuestionResourceQuery,
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

/** How the apps word one of the tutor's suggestions in a language. */
type WordSuggestion = (input: {
  language: string;
  suggestion: LessonScreenSuggestion;
}) => Promise<string>;

/** What the learner asked, as stored: a tapped suggestion in the app's own words. */
type AskedQuestion = { question: string; suggestion: LessonScreenSuggestion | null };

function getCreateLessonQuestionOutcome({
  question,
  requestFingerprint,
}: {
  question: LessonQuestionResourceSource;
  requestFingerprint: string;
}) {
  if (question.requestFingerprint !== requestFingerprint) {
    return { status: "conflict" as const };
  }

  return { question: toLessonQuestionResource(question), status: "created" as const };
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
  input,
  requestFingerprint,
  stepId,
  stepNumber,
  subject,
  userId,
}: {
  asked: AskedQuestion;
  contextSnapshot: LessonQuestionContextSnapshot;
  input: CreateLessonQuestionInput;
  requestFingerprint: string;
  stepId: string | null;
  stepNumber: number | null;
  subject: TutorSubject;
  userId: string;
}) {
  const threadWhere = { ...getSubjectThreadColumn(subject), userId };

  return prisma.$transaction(async (transaction) => {
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
      return getCreateLessonQuestionOutcome({ question: existingQuestion, requestFingerprint });
    }

    const unfinishedQuestion = await transaction.lessonQuestion.findFirst({
      omit: lessonQuestionResourceOmit,
      where: { libraryStepId: stepId, status: { not: "completed" }, threadId: thread.id },
    });

    if (unfinishedQuestion) {
      return { status: "conflict" as const };
    }

    const [created] = await Promise.all([
      transaction.lessonQuestion.create({
        data: {
          contextKind: input.context.kind,
          contextSnapshot: toDatabaseLessonQuestionContextSnapshot(contextSnapshot),
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

/**
 * A tapped suggestion is asked in the app's own words, in the thread's language, whatever words
 * the client sent, so a learner's words never stand in for one. Anything else is asked as written.
 */
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

/**
 * Creates one durable learner turn only after live access to what it's about has been checked and
 * the context the tutor sees has been built on the server: a lesson's screens from the step ids
 * the client sent, or the chapter, plan or finished mock as a whole.
 */
export async function createLessonQuestion({
  input,
  target,
  wordSuggestion,
}: {
  input: CreateLessonQuestionInput;
  target: TutorTarget;
  /** Words a tapped suggestion; without it, a suggestion is asked as the learner's own words. */
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
    return getCreateLessonQuestionOutcome({ question: existingQuestion, requestFingerprint });
  }

  const [context, asked] = await Promise.all([
    buildTutorContextSnapshot({ context: input.context, subject, userId }),
    toAskedQuestion({ input, language: subject.language, wordSuggestion }),
  ]);

  if (context.status !== "ready") {
    return context;
  }

  return persistLessonQuestion({
    asked,
    contextSnapshot: context.contextSnapshot,
    input,
    requestFingerprint,
    stepId: context.stepId,
    stepNumber: context.stepNumber,
    subject,
    userId,
  });
}
