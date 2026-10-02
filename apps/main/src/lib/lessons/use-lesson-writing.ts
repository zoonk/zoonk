"use client";

import { type LessonWritingAnswer, askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { useEffect, useEffectEvent, useReducer } from "react";

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
 * "Never a dead end" for a lesson that isn't written yet: it asks for the lesson (on open when
 * there's a session, after "Start this lesson" for a visitor, so a page load alone never makes a
 * guest or writes a lesson) and says which run writes it, for the wait to follow. `attempt` counts
 * the learner's own requests, so each one gets a fresh wait. `restart` asks again from a failed
 * run's wait and returns the new run's id (null when the request didn't go through).
 */
export function useLessonWriting({
  hasSession,
  lessonId,
}: {
  hasSession: boolean;
  lessonId: string;
}) {
  const [{ attempt, request }, dispatch] = useReducer(writingReducer, {
    attempt: 0,
    request: { status: hasSession ? "requesting" : "idle" },
  });

  const ask = useEffectEvent(async () => {
    dispatch({ request: await askToWriteLesson(lessonId), type: "answered" });
  });

  useEffect(() => {
    if (request.status === "requesting") {
      void ask();
    }
  }, [request.status]);

  function requestAgain() {
    dispatch({ type: "ask" });
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
