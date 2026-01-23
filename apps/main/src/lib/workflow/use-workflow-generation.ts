"use client";

import { useSelector } from "@xstate/store/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type GenerationStatus,
  type StreamMessage,
  createGenerationStore,
  handleStreamMessage,
} from "./generation-store";
import { useSSE } from "./use-sse";

type WorkflowConfig<TStep extends string> = {
  autoTrigger?: boolean;
  completionStep?: TStep;
  initialRunId?: string | null;
  initialStatus?: GenerationStatus;
  statusUrl: string;
  triggerBody: Record<string, unknown>;
  triggerUrl: string;
};

export function useWorkflowGeneration<TStep extends string = string>(
  config: WorkflowConfig<TStep>,
) {
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

  const handleComplete = useCallback(() => store.send({ type: "workflowCompleted" }), [store]);

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
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to start generation");
        }
        const data = await response.json();
        store.send({ runId: data.runId, type: "triggerSuccess" });
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
