"use client";

import { getString } from "@zoonk/utils/json";
import { useCallback, useEffect, useEffectEvent, useReducer, useRef } from "react";
import {
  type GenerationAction,
  type GenerationState,
  type GenerationStatus,
  type StreamMessage,
  generationReducer,
  handleStreamMessage,
  initialGenerationState,
} from "./generation-store";
import { useSSE } from "./use-sse";

const MAX_STREAM_RECONNECTS = 5;

export function useWorkflowGeneration<TStep extends string = string>(config: {
  autoTrigger?: boolean;
  completionStep?: TStep;
  initialRunId?: string | null;
  initialStatus?: GenerationStatus;
  statusUrl: string;
  triggerBody: Record<string, unknown>;
  triggerUrl: string;
}) {
  const { autoTrigger = true, completionStep, statusUrl, triggerBody, triggerUrl } = config;
  const hasTriggeredRef = useRef(false);

  // Wrapper preserves the TStep generic that useReducer would otherwise widen to string.
  const resolvedStatus = config.initialStatus ?? "idle";

  const [state, dispatch] = useReducer(
    (prev: GenerationState<TStep>, action: GenerationAction<TStep>) =>
      generationReducer(prev, action),
    initialGenerationState<TStep>({
      runId: resolvedStatus === "streaming" ? (config.initialRunId ?? null) : null,
      status: resolvedStatus,
    }),
  );

  const handleMessage = useEffectEvent((msg: StreamMessage<TStep>) =>
    handleStreamMessage(msg, dispatch, completionStep),
  );

  /**
   * When the SSE stream closes, check whether we received the expected completion
   * step. If not, the stream was likely cut off (e.g., Vercel function timeout)
   * while the workflow is still running. In that case, schedule a reconnection
   * instead of showing an error — the workflow library supports resumable streaming
   * via `startIndex`, so the next connection picks up where the previous one ended.
   */
  const handleComplete = useEffectEvent(() => {
    const isComplete = !completionStep || state.completedSteps.includes(completionStep);

    if (isComplete || state.reconnectCount >= MAX_STREAM_RECONNECTS) {
      dispatch({ completionStep, type: "streamEnded" });
      return;
    }

    setTimeout(() => {
      dispatch({ type: "reconnect" });
    }, 1000);
  });

  const handleError = useEffectEvent((err: Error) =>
    dispatch({ error: err.message, type: "setError" }),
  );

  /**
   * Include `_rc` (reconnect count) in the URL so that when `reconnectCount`
   * changes, React re-triggers the `useSSE` effect with a fresh connection.
   * The server ignores this parameter (Zod strips unknown keys).
   * `indexRef` inside `useSSE` persists across effect cycles, so the new
   * connection resumes from the last received message index.
   */
  const sseUrl =
    state.status === "streaming" && state.runId
      ? `${statusUrl}?runId=${state.runId}&_rc=${state.reconnectCount}`
      : null;

  const { resetIndex } = useSSE<StreamMessage<TStep>>(sseUrl, {
    onComplete: handleComplete,
    onError: handleError,
    onMessage: handleMessage,
  });

  const startTrigger = useEffectEvent(async () => {
    dispatch({ type: "triggerStart" });

    try {
      const response = await fetch(triggerUrl, {
        body: JSON.stringify(triggerBody),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to start generation");
      }

      const data: unknown = await response.json();
      const newRunId = getString(data, "runId");

      if (!newRunId) {
        throw new Error("Invalid response: missing runId");
      }

      dispatch({ runId: newRunId, type: "triggerSuccess" });
    } catch (error) {
      dispatch({
        error: error instanceof Error ? error.message : "Failed to start",
        type: "setError",
      });
    }
  });

  useEffect(() => {
    if (!autoTrigger || state.status !== "idle" || hasTriggeredRef.current) {
      return;
    }
    hasTriggeredRef.current = true;
    void startTrigger();
  }, [autoTrigger, state.status]);

  const retry = useCallback(() => {
    hasTriggeredRef.current = false;
    resetIndex();
    dispatch({ type: "reset" });
  }, [resetIndex]);

  return {
    completedSteps: state.completedSteps,
    currentStep: state.currentStep,
    error: state.error,
    retry,
    startedSteps: state.startedSteps,
    status: state.status,
  };
}
