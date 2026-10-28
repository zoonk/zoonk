"use client";

import { type LessonWritingAnswer, askToWriteLesson } from "@/lib/lessons/lesson-writing-request";
import { useReducer, useRef } from "react";

export type LessonRequest = LessonWritingAnswer | { status: "idle" } | { status: "requesting" };

type WritingState = { attempt: number; request: LessonRequest };

type WritingAction = { request: LessonRequest; type: "answered" } | { type: "ask" };

function writingReducer(state: WritingState, action: WritingAction): WritingState {
  if (action.type === "ask") {
    return { attempt: state.attempt + 1, request: { status: "requesting" } };
  }

  return { ...state, request: action.request };
}

/** Loading or mounting the wait never starts AI work. */
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
