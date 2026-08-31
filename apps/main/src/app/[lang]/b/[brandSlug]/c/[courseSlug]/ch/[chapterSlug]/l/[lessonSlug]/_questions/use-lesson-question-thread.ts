"use client";

import { type Dispatch, useCallback, useRef } from "react";
import { getLessonQuestionThreadRequest } from "./lesson-question-api";
import { type LessonQuestionAction, type LessonQuestionState } from "./lesson-question-state";

export function useLessonQuestionThread({
  canAskQuestions,
  dispatch,
  lessonId,
  state,
}: {
  canAskQuestions: boolean;
  dispatch: Dispatch<LessonQuestionAction>;
  lessonId: string;
  state: LessonQuestionState;
}) {
  const latestLoadRevision = useRef(0);

  const loadThread = useCallback(async () => {
    if (!canAskQuestions) {
      return null;
    }

    const loadRevision = latestLoadRevision.current + 1;
    latestLoadRevision.current = loadRevision;
    dispatch({ type: "threadLoadStarted" });
    const result = await getLessonQuestionThreadRequest({ lessonId });

    if (loadRevision !== latestLoadRevision.current) {
      return null;
    }

    if (result.status === "error") {
      dispatch({ reason: result.error, type: "threadLoadFailed" });
      return null;
    }

    const questions = result.data?.questions ?? [];

    dispatch({
      hasMore: result.data?.hasMore ?? false,
      nextCursor: result.data?.nextCursor ?? null,
      questions,
      type: "threadLoaded",
    });

    return questions;
  }, [canAskQuestions, dispatch, lessonId]);

  const load = useCallback(async () => (await loadThread()) !== null, [loadThread]);

  const loadEarlier = useCallback(async () => {
    if (!canAskQuestions || !state.hasMore || !state.nextCursor || state.isLoadingEarlier) {
      return;
    }

    const loadRevision = latestLoadRevision.current;
    dispatch({ type: "earlierThreadLoadStarted" });
    const result = await getLessonQuestionThreadRequest({ cursor: state.nextCursor, lessonId });

    if (loadRevision !== latestLoadRevision.current) {
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
    canAskQuestions,
    dispatch,
    lessonId,
    state.hasMore,
    state.isLoadingEarlier,
    state.nextCursor,
  ]);

  const reconcileLatestThread = useCallback(async () => {
    if (!canAskQuestions) {
      return false;
    }

    const result = await getLessonQuestionThreadRequest({ lessonId });

    if (result.status === "error") {
      return false;
    }

    dispatch({ questions: result.data?.questions ?? [], type: "latestThreadReconciled" });
    return true;
  }, [canAskQuestions, dispatch, lessonId]);

  return { load, loadEarlier, loadThread, reconcileLatestThread };
}
