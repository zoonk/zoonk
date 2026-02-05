"use client";

import { useSelector } from "@xstate/store/react";
import { getString } from "@zoonk/utils/json";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type GenerationStatus,
  type StreamMessage,
  createGenerationStore,
  handleStreamMessage,
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

  const store = useMemo(
    () =>
      createGenerationStore<TStep>({
        runId: config.initialRunId ?? null,
        status: config.initialRunId ? "streaming" : (config.initialStatus ?? "idle"),
      }),
    [config.initialRunId, config.initialStatus],
  );

  const completedSteps = useSelector(store, (state) => state.context.completedSteps);
  const currentStep = useSelector(store, (state) => state.context.currentStep);
  const error = useSelector(store, (state) => state.context.error);
  const runId = useSelector(store, (state) => state.context.runId);
  const status = useSelector(store, (state) => state.context.status);

  const handleMessage = useCallback(
    (msg: StreamMessage<TStep>) => handleStreamMessage(msg, store, completionStep),
    [store, completionStep],
  );

  const handleComplete = useCallback(() => {
    const snapshot = store.getSnapshot();

    // If handleStreamMessage already transitioned to completed or error, do nothing.
    if (snapshot.context.status === "completed" || snapshot.context.status === "error") {
      return;
    }

    // Stream ended without the completion step — premature close.
    if (completionStep && !snapshot.context.completedSteps.includes(completionStep)) {
      store.send({
        error: "Generation ended unexpectedly. Please try again.",
        type: "setError",
      });
      return;
    }

    store.send({ type: "workflowCompleted" });
  }, [store, completionStep]);

  const handleError = useCallback(
    (err: Error) => store.send({ error: err.message, type: "setError" }),
    [store],
  );

  const { resetIndex } = useSSE<StreamMessage<TStep>>(
    status === "streaming" && runId ? `${statusUrl}?runId=${runId}` : null,
    {
      onComplete: handleComplete,
      onError: handleError,
      onMessage: handleMessage,
    },
  );

  useEffect(() => {
    if (!autoTrigger || status !== "idle" || hasTriggeredRef.current) {
      return;
    }
    hasTriggeredRef.current = true;

    void (async () => {
      store.send({ type: "triggerStart" });
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
        const runId = getString(data, "runId");
        if (!runId) {
          throw new Error("Invalid response: missing runId");
        }
        store.send({ runId, type: "triggerSuccess" });
      } catch (error) {
        store.send({
          error: error instanceof Error ? error.message : "Failed to start",
          type: "setError",
        });
      }
    })();
  }, [autoTrigger, status, triggerUrl, triggerBody, store]);

  const retry = useCallback(() => {
    hasTriggeredRef.current = false;
    resetIndex();
    store.send({ type: "reset" });
  }, [resetIndex, store]);

  return {
    completedSteps,
    currentStep,
    error,
    retry,
    status,
  };
}
