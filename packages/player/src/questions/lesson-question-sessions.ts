import { type PlayerQuestionContext } from "../player-context";
import { getLessonQuestionScope } from "./lesson-question-scope";
import {
  INITIAL_LESSON_QUESTION_STATE,
  type LessonQuestionAction,
  type LessonQuestionState,
  lessonQuestionReducer,
} from "./lesson-question-state";

export type LessonQuestionSessionAction = {
  action: LessonQuestionAction;
  context: PlayerQuestionContext;
};

type LessonQuestionSessions = Partial<Record<string, LessonQuestionState>>;

export const INITIAL_LESSON_QUESTION_SESSIONS: LessonQuestionSessions = {};

export function getLessonQuestionSession({
  context,
  sessions,
}: {
  context: PlayerQuestionContext;
  sessions: LessonQuestionSessions;
}): LessonQuestionState {
  return sessions[getLessonQuestionScope(context)] ?? { ...INITIAL_LESSON_QUESTION_STATE, context };
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
