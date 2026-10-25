import { type LessonQuestionContext, isAboutCheckedAnswer } from "./lesson-question-context";
import { getLessonQuestionScope } from "./lesson-question-scope";
import {
  INITIAL_LESSON_QUESTION_STATE,
  type LessonQuestionAction,
  type LessonQuestionState,
  lessonQuestionReducer,
} from "./lesson-question-state";
import { doesLessonQuestionBlockNewQuestion } from "./lesson-question-status";

export type LessonQuestionSessionAction = {
  action: LessonQuestionAction;
  context: LessonQuestionContext;
};

type LessonQuestionSessions = Partial<Record<string, LessonQuestionState>>;

export const INITIAL_LESSON_QUESTION_SESSIONS: LessonQuestionSessions = {};

export function getLessonQuestionSession({
  context,
  sessions,
}: {
  context: LessonQuestionContext;
  sessions: LessonQuestionSessions;
}): LessonQuestionState {
  return sessions[getLessonQuestionScope(context)] ?? { ...INITIAL_LESSON_QUESTION_STATE, context };
}

/**
 * The conversation as the learner sees it from where they are. Before a question is checked the
 * buddy only gives hints, so what it said about an earlier answer to it (a question coming back at
 * the end of the lesson, or asked again in practice) waits until this one is checked. An answer
 * still unfinished stays, so the learner can finish it before asking more.
 */
export function getShownLessonQuestionSession({
  context,
  session,
}: {
  context: LessonQuestionContext;
  session: LessonQuestionState;
}): LessonQuestionState {
  if (isAboutCheckedAnswer(context)) {
    return session;
  }

  const questions = session.questions.filter(
    (question) =>
      !isAboutCheckedAnswer(question.context) || doesLessonQuestionBlockNewQuestion(question),
  );

  return questions.length === session.questions.length ? session : { ...session, questions };
}

/** Late responses update their own step, while revisiting a step restores its saved conversation immediately. */
export function lessonQuestionSessionsReducer(
  state: LessonQuestionSessions,
  { action, context }: LessonQuestionSessionAction,
): LessonQuestionSessions {
  const scope = getLessonQuestionScope(context);
  const session = getLessonQuestionSession({ context, sessions: state });

  return { ...state, [scope]: lessonQuestionReducer(session, action) };
}
