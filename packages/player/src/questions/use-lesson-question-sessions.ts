"use client";

import { type LessonQuestionThreadResource } from "@zoonk/core/lesson-questions/contract";
import { useCallback, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { type LessonQuestionContext } from "./lesson-question-context";
import { getLessonQuestionScope } from "./lesson-question-scope";
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
    action: { ...initialThread, type: "threadLoaded" },
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

  const scope = getLessonQuestionScope(activeContext);

  const [receivedPages, setReceivedPages] = useState(
    () => new Map(initialThread ? [[scope, initialThread]] : []),
  );

  if (initialThread && receivedPages.get(scope) !== initialThread) {
    setReceivedPages(new Map(receivedPages).set(scope, initialThread));

    dispatchToContext({
      action: { ...initialThread, fromPage: true, type: "threadLoaded" },
      context: activeContext,
    });
  }

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
