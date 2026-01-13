"use client";

import { useEffect, useEffectEvent, useReducer, useRef } from "react";
import useSWR from "swr";

type StepStatus = "started" | "completed" | "error";

export type StreamMessage<TStep extends string = string> = {
  step: TStep;
  status: StepStatus;
};

type GenerationState<TStep extends string> = {
  completedSteps: TStep[];
  currentStep: TStep | null;
  error: string | null;
  runId: string | null;
  status: "idle" | "triggering" | "streaming" | "completed" | "error";
};

type GenerationAction<TStep extends string> =
  | { type: "TRIGGER_START" }
  | { type: "TRIGGER_SUCCESS"; runId: string }
  | { type: "STEP_STARTED"; step: TStep }
  | { type: "STEP_COMPLETED"; step: TStep }
  | { type: "SET_ERROR"; error: string }
  | { type: "WORKFLOW_COMPLETED" }
  | { type: "RESET" };

function reducer<TStep extends string>(
  state: GenerationState<TStep>,
  action: GenerationAction<TStep>,
): GenerationState<TStep> {
  switch (action.type) {
    case "TRIGGER_START":
      return { ...state, error: null, status: "triggering" };

    case "TRIGGER_SUCCESS":
      return { ...state, runId: action.runId, status: "streaming" };

    case "SET_ERROR":
      return { ...state, error: action.error, status: "error" };

    case "STEP_STARTED":
      return { ...state, currentStep: action.step };

    case "STEP_COMPLETED":
      return {
        ...state,
        completedSteps: state.completedSteps.includes(action.step)
          ? state.completedSteps
          : [...state.completedSteps, action.step],
        currentStep: null,
      };

    case "WORKFLOW_COMPLETED":
      return { ...state, status: "completed" };

    case "RESET":
      return {
        completedSteps: [],
        currentStep: null,
        error: null,
        runId: null,
        status: "idle",
      };

    default:
      return state;
  }
}

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

function dispatchMessage<TStep extends string>(
  message: StreamMessage<TStep>,
  dispatch: React.Dispatch<GenerationAction<TStep>>,
) {
  switch (message.status) {
    case "started":
      dispatch({ step: message.step, type: "STEP_STARTED" });
      break;
    case "completed":
      dispatch({ step: message.step, type: "STEP_COMPLETED" });
      break;
    case "error":
      dispatch({ error: "Step failed", type: "SET_ERROR" });
      break;
  }
}

function processLines<TStep extends string>(
  lines: string[],
  dispatch: React.Dispatch<GenerationAction<TStep>>,
): number {
  let count = 0;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    try {
      const message = JSON.parse(line) as StreamMessage<TStep>;
      count += 1;
      dispatchMessage(message, dispatch);
    } catch {
      // Skip malformed lines
    }
  }

  return count;
}

async function* streamChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  let result = await reader.read();

  while (!result.done) {
    yield result.value;
    // biome-ignore lint/performance/noAwaitInLoops: Sequential reads required for streaming
    result = await reader.read();
  }
}

async function readStream<TStep extends string>(
  response: Response,
  dispatch: React.Dispatch<GenerationAction<TStep>>,
  startIndex: number,
): Promise<number> {
  if (!response.body) {
    return startIndex;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let index = startIndex;

  for await (const chunk of streamChunks(reader)) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    index += processLines<TStep>(lines, dispatch);
  }

  return index;
}

export function useWorkflowGeneration<TStep extends string = string>(
  config: WorkflowConfig,
) {
  const {
    autoTrigger = true,
    initialRunId = null,
    initialStatus = "idle",
    pollingInterval = 2000,
    statusUrl,
    triggerBody,
    triggerUrl,
  } = config;

  const [state, dispatch] = useReducer(reducer<TStep>, {
    completedSteps: [],
    currentStep: null,
    error: null,
    runId: initialRunId,
    status: initialRunId ? "streaming" : initialStatus,
  });

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

  // Event handler for triggering - not a dependency of effects
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
        streamIndexRef.current = await readStream<TStep>(
          response,
          dispatch,
          streamIndexRef.current,
        );
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
