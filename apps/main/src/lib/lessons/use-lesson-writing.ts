"use client";

import { type LessonWritingAnswer, askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { useReducer, useRef } from "react";

/**
 * Where asking for the lesson stands: `idle` until a visitor asks for it, `requesting` while the
 * request is on its way, then what the API answered (see `LessonWritingAnswer`).
 */
export type LessonRequest = LessonWritingAnswer | { status: "idle" } | { status: "requesting" };

type WritingState = { attempt: number; request: LessonRequest };

type WritingAction = { request: LessonRequest; type: "answered" } | { type: "ask" };

/** Each request the learner makes counts as a new attempt; the API's answer says where it stands. */
function writingReducer(state: WritingState, action: WritingAction): WritingState {
  if (action.type === "ask") {
    return { attempt: state.attempt + 1, request: { status: "requesting" } };
  }

  return { ...state, request: action.request };
}

/**
 * Asks for writing only from the learner's action, or follows the run handed over by the click
 * that opened this page. Loading or mounting the wait never starts AI work. `attempt` counts
 * the learner's own requests, so each one gets a fresh wait. `restart` asks again from a failed
 * run's wait and returns the new run's id (null when the request didn't go through).
 */
export function useLessonWriting({
  initialRequest,
  lessonId,
}: {
  initialRequest: LessonRequest;
  lessonId: string;
}) {
  const [{ attempt, request }, dispatch] = useReducer(writingReducer, {
    attempt: 0,
    request: initialRequest,
  });

  const requesting = useRef(false);

  async function requestAgain() {
    if (requesting.current) {
      return;
    }

    requesting.current = true;
    dispatch({ type: "ask" });

    try {
      dispatch({ request: await askToWriteLesson(lessonId), type: "answered" });
    } finally {
      requesting.current = false;
    }
  }

  async function restart(): Promise<string | null | undefined> {
    const next = await askToWriteLesson(lessonId);
    dispatch({ request: next, type: "answered" });

    if (next.status === "writing") {
      return next.generationId;
    }

    // Written meanwhile, or not allowed now: the page says so instead of the wait.
    return next.status === "failed" ? null : undefined;
  }

  return {
    attempt,
    generationId: request.status === "writing" ? request.generationId : null,
    request,
    restart,
    retry: requestAgain,
    start: requestAgain,
  };
}
