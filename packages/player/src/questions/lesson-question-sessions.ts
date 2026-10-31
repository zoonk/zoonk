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

export function lessonQuestionSessionsReducer(
  state: LessonQuestionSessions,
  { action, context }: LessonQuestionSessionAction,
): LessonQuestionSessions {
  const scope = getLessonQuestionScope(context);
  const session = getLessonQuestionSession({ context, sessions: state });

  return { ...state, [scope]: lessonQuestionReducer(session, action) };
}
