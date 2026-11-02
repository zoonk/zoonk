"use client";

import { type LessonQuestionThreadResource } from "@zoonk/core/lesson-questions/contract";
import { useCallback, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import { type LessonQuestionContext } from "./lesson-question-context";
import {
  INITIAL_LESSON_QUESTION_SESSIONS,
  getLessonQuestionSession,
  getShownLessonQuestionSession,
  lessonQuestionSessionsReducer,
} from "./lesson-question-sessions";
import { type LessonQuestionAction } from "./lesson-question-state";

export type LessonQuestionThreadPage = Pick<
  LessonQuestionThreadResource,
  "hasMore" | "nextCursor" | "questions"
>;

function getInitialSessions({
  activeContext,
  initialThread,
}: {
  activeContext: LessonQuestionContext;
  initialThread: LessonQuestionThreadPage | null;
}) {
  if (!initialThread) {
    return INITIAL_LESSON_QUESTION_SESSIONS;
  }

  return lessonQuestionSessionsReducer(INITIAL_LESSON_QUESTION_SESSIONS, {
    action: {
      hasMore: initialThread.hasMore,
      nextCursor: initialThread.nextCursor,
      questions: initialThread.questions,
      type: "threadLoaded",
    },
    context: activeContext,
  });
}

export function useLessonQuestionSessions({
  activeContext,
  initialThread,
}: {
  activeContext: LessonQuestionContext;
  initialThread: LessonQuestionThreadPage | null;
}) {
  const [sessions, dispatchToContext] = useReducer(
    lessonQuestionSessionsReducer,
    { activeContext, initialThread },
    getInitialSessions,
  );

  const currentSessions = useRef(sessions);

  useLayoutEffect(() => {
    currentSessions.current = sessions;
  }, [sessions]);

  const session = getLessonQuestionSession({ context: activeContext, sessions });

  const state = useMemo(
    () => getShownLessonQuestionSession({ context: activeContext, session }),
    [activeContext, session],
  );

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
