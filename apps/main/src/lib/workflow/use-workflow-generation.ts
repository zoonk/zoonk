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

  const handleComplete = useEffectEvent(() => {
    dispatch({ completionStep, type: "streamEnded" });
  });

  const handleError = useEffectEvent((err: Error) =>
    dispatch({ error: err.message, type: "setError" }),
  );

  const { resetIndex } = useSSE<StreamMessage<TStep>>(
    state.status === "streaming" && state.runId ? `${statusUrl}?runId=${state.runId}` : null,
    {
      onComplete: handleComplete,
      onError: handleError,
      onMessage: handleMessage,
    },
  );

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
