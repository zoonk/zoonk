"use client";

import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import { type LessonQuestionContext } from "./lesson-question-context";
import {
  INITIAL_LESSON_QUESTION_SESSIONS,
  getLessonQuestionSession,
  lessonQuestionSessionsReducer,
} from "./lesson-question-sessions";
import { type LessonQuestionAction } from "./lesson-question-state";

export function useLessonQuestionSessions(activeContext: LessonQuestionContext) {
  const [sessions, dispatchToContext] = useReducer(
    lessonQuestionSessionsReducer,
    INITIAL_LESSON_QUESTION_SESSIONS,
  );

  const currentSessions = useRef(sessions);

  useLayoutEffect(() => {
    currentSessions.current = sessions;
  }, [sessions]);

  const state = getLessonQuestionSession({ context: activeContext, sessions });

  const context = state.context;

  const dispatch = useCallback(
    (action: LessonQuestionAction) => dispatchToContext({ action, context }),
    [context],
  );

  const getState = useCallback(
    (requestedContext: LessonQuestionContext) =>
      getLessonQuestionSession({ context: requestedContext, sessions: currentSessions.current }),
    [],
  );

  return { dispatch, dispatchToContext, getState, state };
}
