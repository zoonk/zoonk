"use client";

import { createParser, type EventSourceMessage } from "eventsource-parser";
import { useEffect, useEffectEvent, useReducer, useRef } from "react";
import useSWR from "swr";
import {
  dispatchMessage,
  type GenerationAction,
  type GenerationState,
  generationReducer,
  type StreamMessage,
} from "./generation-reducer";

type WorkflowConfig = {
  autoTrigger?: boolean;
  initialRunId?: string | null;
  initialStatus?: "idle" | "streaming";
  pollingInterval?: number;
  statusUrl: string;
  triggerBody: Record<string, unknown>;
  triggerUrl: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

async function readSSEStream<TStep extends string>(
  response: Response,
  dispatch: React.Dispatch<GenerationAction<TStep>>,
  onMessage: () => void,
) {
  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }

  const decoder = new TextDecoder();
  const parser = createParser({
    onEvent: (event: EventSourceMessage) => {
      onMessage();
      const message = JSON.parse(event.data) as StreamMessage<TStep>;
      dispatchMessage(message, dispatch);
    },
  });

  let result = await reader.read();

  while (!result.done) {
    parser.feed(decoder.decode(result.value, { stream: true }));
    // biome-ignore lint/performance/noAwaitInLoops: Sequential reads required for streaming
    result = await reader.read();
  }
}

function getInitialState<TStep extends string>(
  config: WorkflowConfig,
): GenerationState<TStep> {
  return {
    completedSteps: [],
    currentStep: null,
    error: null,
    runId: config.initialRunId ?? null,
    status: config.initialRunId
      ? "streaming"
      : (config.initialStatus ?? "idle"),
  };
}

export function useWorkflowGeneration<TStep extends string = string>(
  config: WorkflowConfig,
) {
  const {
    autoTrigger = true,
    pollingInterval = 2000,
    statusUrl,
    triggerBody,
    triggerUrl,
  } = config;

  const [state, dispatch] = useReducer(
    generationReducer<TStep>,
    getInitialState<TStep>(config),
  );

  const streamIndexRef = useRef(0);
  const hasTriggeredRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { data: statusData } = useSWR<{ status: string }>(
    state.runId && state.status === "streaming"
      ? `/api/workflows/run-status?runId=${state.runId}`
      : null,
    fetcher,
    { refreshInterval: pollingInterval, revalidateOnFocus: false },
  );

  const trigger = useEffectEvent(async () => {
    dispatch({ type: "TRIGGER_START" });

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
      dispatch({ runId: data.runId, type: "TRIGGER_SUCCESS" });
    } catch (err) {
      dispatch({
        error: err instanceof Error ? err.message : "Failed to start",
        type: "SET_ERROR",
      });
    }
  });

  function retry() {
    abortControllerRef.current?.abort();
    streamIndexRef.current = 0;
    hasTriggeredRef.current = false;
    dispatch({ type: "RESET" });
  }

  // Auto-trigger on mount
  useEffect(() => {
    if (autoTrigger && state.status === "idle" && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      void trigger();
    }
  }, [autoTrigger, state.status]);

  // Stream status updates when we have a runId
  useEffect(() => {
    if (state.status !== "streaming" || !state.runId) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startStream = async () => {
      try {
        const url = `${statusUrl}?runId=${state.runId}&startIndex=${streamIndexRef.current}`;
        const response = await fetch(url, { signal: controller.signal });
        await readSSEStream<TStep>(response, dispatch, () => {
          streamIndexRef.current += 1;
        });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Stream error:", err);
        }
      }
    };

    void startStream();

    return () => controller.abort();
  }, [state.runId, state.status, statusUrl]);

  // Handle workflow completion from polling
  useEffect(() => {
    if (statusData?.status === "completed") {
      dispatch({ type: "WORKFLOW_COMPLETED" });
    } else if (statusData?.status === "failed") {
      dispatch({ error: "Workflow failed", type: "SET_ERROR" });
    }
  }, [statusData?.status]);

  return {
    completedSteps: state.completedSteps,
    currentStep: state.currentStep,
    error: state.error,
    retry,
    status: state.status,
    trigger,
  };
}
