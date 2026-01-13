"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
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
  | { type: "TRIGGER_ERROR"; error: string }
  | { type: "STEP_STARTED"; step: TStep }
  | { type: "STEP_COMPLETED"; step: TStep }
  | { type: "STEP_ERROR"; error: string }
  | { type: "WORKFLOW_COMPLETED" }
  | { type: "WORKFLOW_FAILED"; error: string }
  | { type: "RESET" };

function createReducer<TStep extends string>() {
  return function reducer(
    state: GenerationState<TStep>,
    action: GenerationAction<TStep>,
  ): GenerationState<TStep> {
    switch (action.type) {
      case "TRIGGER_START":
        return { ...state, error: null, status: "triggering" };

      case "TRIGGER_SUCCESS":
        return { ...state, runId: action.runId, status: "streaming" };

      case "TRIGGER_ERROR":
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

      case "STEP_ERROR":
        return { ...state, error: action.error, status: "error" };

      case "WORKFLOW_COMPLETED":
        return { ...state, status: "completed" };

      case "WORKFLOW_FAILED":
        return { ...state, error: action.error, status: "error" };

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
  };
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

function parseStreamMessage<TStep extends string>(
  line: string,
): StreamMessage<TStep> | null {
  if (!line.trim()) {
    return null;
  }
  try {
    return JSON.parse(line) as StreamMessage<TStep>;
  } catch {
    return null;
  }
}

function handleStreamMessage<TStep extends string>(
  message: StreamMessage<TStep>,
  dispatch: React.Dispatch<GenerationAction<TStep>>,
) {
  if (message.status === "started") {
    dispatch({ step: message.step, type: "STEP_STARTED" });
  } else if (message.status === "completed") {
    dispatch({ step: message.step, type: "STEP_COMPLETED" });
  } else if (message.status === "error") {
    dispatch({ error: "Step failed", type: "STEP_ERROR" });
  }
}

function processStreamChunk<TStep extends string>(
  lines: string[],
  dispatch: React.Dispatch<GenerationAction<TStep>>,
  indexRef: React.MutableRefObject<number>,
) {
  for (const line of lines) {
    const message = parseStreamMessage<TStep>(line);
    if (message) {
      indexRef.current += 1;
      handleStreamMessage(message, dispatch);
    }
  }
}

type StreamReaderContext<TStep extends string> = {
  decoder: TextDecoder;
  dispatch: React.Dispatch<GenerationAction<TStep>>;
  indexRef: React.MutableRefObject<number>;
  reader: ReadableStreamDefaultReader<Uint8Array>;
};

async function readStreamChunk<TStep extends string>(
  ctx: StreamReaderContext<TStep>,
  buffer: string,
): Promise<void> {
  const result = await ctx.reader.read();

  if (result.done) {
    return;
  }

  const newBuffer = buffer + ctx.decoder.decode(result.value, { stream: true });
  const lines = newBuffer.split("\n");
  const remaining = lines.pop() ?? "";

  processStreamChunk<TStep>(lines, ctx.dispatch, ctx.indexRef);

  return readStreamChunk(ctx, remaining);
}

async function readStream<TStep extends string>(
  response: Response,
  dispatch: React.Dispatch<GenerationAction<TStep>>,
  indexRef: React.MutableRefObject<number>,
) {
  if (!response.body) {
    return;
  }

  const ctx: StreamReaderContext<TStep> = {
    decoder: new TextDecoder(),
    dispatch,
    indexRef,
    reader: response.body.getReader(),
  };

  return readStreamChunk(ctx, "");
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

  const reducer = createReducer<TStep>();
  const [state, dispatch] = useReducer(reducer, {
    completedSteps: [],
    currentStep: null,
    error: null,
    runId: initialRunId,
    status: initialRunId ? "streaming" : initialStatus,
  });

  const streamIndexRef = useRef(0);
  const hasTriggeredRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Poll for workflow completion
  const { data: statusData } = useSWR<{ status: string }>(
    state.runId && state.status === "streaming"
      ? `/api/workflows/run-status?runId=${state.runId}`
      : null,
    fetcher,
    { refreshInterval: pollingInterval, revalidateOnFocus: false },
  );

  // Trigger workflow
  const trigger = useCallback(async () => {
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
        type: "TRIGGER_ERROR",
      });
    }
  }, [triggerBody, triggerUrl]);

  // Reset and retry
  const retry = useCallback(() => {
    abortControllerRef.current?.abort();
    streamIndexRef.current = 0;
    hasTriggeredRef.current = false;
    dispatch({ type: "RESET" });
  }, []);

  // Auto-trigger and streaming effect
  useEffect(() => {
    // Auto-trigger on mount
    if (autoTrigger && state.status === "idle" && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      void trigger();
      return;
    }

    // Stream status updates
    if (state.status === "streaming" && state.runId) {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const startStream = async () => {
        try {
          const url = `${statusUrl}?runId=${state.runId}&startIndex=${streamIndexRef.current}`;
          const response = await fetch(url, { signal: controller.signal });
          await readStream<TStep>(response, dispatch, streamIndexRef);
        } catch (err) {
          if (err instanceof Error && err.name !== "AbortError") {
            console.error("Stream error:", err);
          }
        }
      };

      void startStream();

      return () => controller.abort();
    }
  }, [autoTrigger, state.runId, state.status, statusUrl, trigger]);

  // Handle workflow status from polling
  useEffect(() => {
    if (statusData?.status === "completed") {
      dispatch({ type: "WORKFLOW_COMPLETED" });
    } else if (statusData?.status === "failed") {
      dispatch({ error: "Workflow failed", type: "WORKFLOW_FAILED" });
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
