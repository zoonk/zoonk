"use client";

import { type Dispatch, useCallback, useRef } from "react";
import { type PlayerQuestionContext } from "../player-context";
import {
  type LessonQuestionConnection,
  getLessonQuestionThreadRequest,
} from "./lesson-question-api";
import { getLessonQuestionScope, getLessonQuestionScopeQuery } from "./lesson-question-scope";
import { type LessonQuestionSessionAction } from "./lesson-question-sessions";
import { type LessonQuestionAction, type LessonQuestionState } from "./lesson-question-state";

export function useLessonQuestionThread({
  connection,
  canAskQuestions,
  dispatch,
  dispatchToContext,
  getState,
  lessonId,
  state,
}: {
  connection: LessonQuestionConnection;
  canAskQuestions: boolean;
  dispatch: Dispatch<LessonQuestionAction>;
  dispatchToContext: Dispatch<LessonQuestionSessionAction>;
  getState: (context: PlayerQuestionContext) => LessonQuestionState;
  lessonId: string;
  state: LessonQuestionState;
}) {
  const latestLoadRevisions = useRef(new Map<string, number>());

  const loadThread = useCallback(
    async (context: PlayerQuestionContext) => {
      const dispatchToSession = (action: LessonQuestionAction) =>
        dispatchToContext({ action, context });

      const current = getState(context);

      if (current.activeQuestionId || current.isCreating) {
        return current.questions;
      }

      if (!canAskQuestions) {
        return null;
      }

      const scope = getLessonQuestionScope(context);
      const loadRevision = (latestLoadRevisions.current.get(scope) ?? 0) + 1;
      latestLoadRevisions.current.set(scope, loadRevision);
      dispatchToSession({ type: "threadLoadStarted" });

      const result = await getLessonQuestionThreadRequest({
        connection,
        lessonId,
        ...getLessonQuestionScopeQuery(context),
      });

      if (loadRevision !== latestLoadRevisions.current.get(scope)) {
        return null;
      }

      if (result.status === "error") {
        dispatchToSession({ reason: result.error, type: "threadLoadFailed" });
        return null;
      }

      const questions = result.data?.questions ?? [];

      dispatchToSession({
        hasMore: result.data?.hasMore ?? false,
        nextCursor: result.data?.nextCursor ?? null,
        questions,
        type: "threadLoaded",
      });

      return questions;
    },
    [connection, canAskQuestions, dispatchToContext, getState, lessonId],
  );

  const load = useCallback(
    async () => (await loadThread(state.context)) !== null,
    [loadThread, state.context],
  );

  const loadEarlier = useCallback(async () => {
    if (!canAskQuestions || !state.hasMore || !state.nextCursor || state.isLoadingEarlier) {
      return;
    }

    const scope = getLessonQuestionScope(state.context);
    const loadRevision = latestLoadRevisions.current.get(scope);
    dispatch({ type: "earlierThreadLoadStarted" });

    const result = await getLessonQuestionThreadRequest({
      connection,
      ...getLessonQuestionScopeQuery(state.context),
      cursor: state.nextCursor,
      lessonId,
    });

    if (loadRevision !== latestLoadRevisions.current.get(scope)) {
      return;
    }

    if (result.status === "error" || !result.data) {
      dispatch({ type: "earlierThreadLoadFailed" });
      return;
    }

    dispatch({
      hasMore: result.data.hasMore,
      nextCursor: result.data.nextCursor,
      questions: result.data.questions,
      type: "earlierThreadLoaded",
    });
  }, [
    connection,
    canAskQuestions,
    dispatch,
    lessonId,
    state.context,
    state.hasMore,
    state.isLoadingEarlier,
    state.nextCursor,
  ]);

  const reconcileLatestThread = useCallback(
    async (context: PlayerQuestionContext) => {
      const dispatchToSession = (action: LessonQuestionAction) =>
        dispatchToContext({ action, context });

      if (!canAskQuestions) {
        return false;
      }

      const result = await getLessonQuestionThreadRequest({
        connection,
        lessonId,
        ...getLessonQuestionScopeQuery(context),
      });

      if (result.status === "error") {
        return false;
      }

      dispatchToSession({
        questions: result.data?.questions ?? [],
        type: "latestThreadReconciled",
      });

      return true;
    },
    [connection, canAskQuestions, dispatchToContext, lessonId],
  );

  return { load, loadEarlier, loadThread, reconcileLatestThread };
}
