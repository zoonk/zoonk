"use client";

import { type SpokenAnswerGrade } from "@zoonk/core/library/language/spoken-answer-contract";
import { type Dispatch, useRef, useState } from "react";
import {
  type MistakePracticeFeedback,
  type PracticeAction,
  type PracticeStep,
} from "./mistake-practice-state";

type RecordingInput = { audio: Blob; durationMs: number };

type RecordingIssue =
  | { status: "noSpeech" }
  | { status: "limitReached"; tier: "free" | "guest" | "plus"; period?: "day" | "month" | "total" }
  | { status: "signUpRequired" }
  | { status: "slowDown"; retryAfterSeconds: number };

type PracticeRecordingOutcome =
  | { status: "graded"; feedback: NonNullable<MistakePracticeFeedback>; grade: SpokenAnswerGrade }
  | { status: "failed" }
  | RecordingIssue;

export type RecordMistakeAction = (
  input: RecordingInput & {
    attemptId: string;
    practiceDurationMs: number;
    mistakeId: string;
    stepId: string;
    runAnswerIds: string[];
  },
) => Promise<PracticeRecordingOutcome>;

export function usePracticeRecording({
  answerIds,
  dispatch,
  elapsedMs,
  index,
  record,
  step,
}: {
  answerIds: string[];
  dispatch: Dispatch<PracticeAction>;
  elapsedMs: () => number;
  index: number;
  record: RecordMistakeAction | undefined;
  step: PracticeStep | undefined;
}) {
  const [recordIssue, setRecordIssue] = useState<RecordingIssue | null>(null);

  const recording = useRef<
    (RecordingInput & { attemptId: string; index: number; practiceDurationMs: number }) | null
  >(null);

  const sendRecording = async (input: NonNullable<typeof recording.current>) => {
    if (!step?.lesson || !record) {
      return;
    }

    const outcome = await record({
      ...input,
      mistakeId: step.entry.mistakeId,
      runAnswerIds: answerIds,
      stepId: step.lesson.step.id,
    }).catch(() => ({ status: "failed" as const }));

    if (outcome.status === "graded") {
      dispatch({
        feedback: outcome.feedback,
        mistakeId: step.entry.mistakeId,
        spoken: outcome.grade,
        type: "answered",
      });

      return;
    }

    if (outcome.status !== "failed") {
      setRecordIssue(outcome);

      if (outcome.status === "slowDown") {
        dispatch({ type: "answerFailed" });
      } else {
        recording.current = null;
        dispatch({ answer: null, type: "select" });
      }

      return;
    }

    dispatch({ type: "answerFailed" });
  };

  return {
    record: record
      ? (input: RecordingInput) => {
          const pending = {
            ...input,
            attemptId: crypto.randomUUID(),
            index,
            practiceDurationMs: elapsedMs(),
          };

          recording.current = pending;
          setRecordIssue(null);

          dispatch({
            answer: { kind: "spokenAnswer", text: "" },
            durationMs: pending.practiceDurationMs,
            sender: "check",
            type: "check",
          });

          void sendRecording(pending);
        }
      : undefined,
    recordIssue,
    reset: () => {
      recording.current = null;
      setRecordIssue(null);
    },
    retry: () => {
      if (recording.current?.index !== index) {
        return false;
      }

      setRecordIssue(null);
      void sendRecording(recording.current);
      return true;
    },
  };
}
