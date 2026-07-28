"use client";

import { type StepStreamMessage } from "@zoonk/core/workflows/steps";
import { getString } from "@zoonk/utils/json";
import { API_URL } from "@zoonk/utils/url";
import { useCallback, useEffect, useEffectEvent, useReducer, useRef } from "react";
import { getGenerationEventsUrl } from "./_utils/generation-events-url";
import { getWorkflowAuthHeaders } from "./auth-headers";
import {
  type GenerationAction,
  type GenerationState,
  type GenerationStatus,
  generationReducer,
  handleStepStreamMessage,
  initialGenerationState,
} from "./generation-store";
import { type GenerationTarget } from "./generation-target";
import { useSSE } from "./use-sse";

const MAX_STREAM_RECONNECTS = 5;

/**
 * Builds the authenticated JSON request accepted by the unified generation
 * collection.
 */
function getGenerationTriggerRequest({
  authHeaders,
  target,
}: {
  authHeaders: Awaited<ReturnType<typeof getWorkflowAuthHeaders>>;
  target: GenerationTarget;
}): RequestInit {
  return {
    body: JSON.stringify({ target }),
    headers: { ...authHeaders, "Content-Type": "application/json" },
    method: "POST",
  };
}

export function useWorkflowGeneration<TStep extends string = string>(config: {
  autoTrigger?: boolean;
  completionStep?: TStep;
  entityId?: string;
  initialRunId?: string | null;
  initialStatus?: GenerationStatus;
  target: GenerationTarget;
}) {
  const { autoTrigger = true, completionStep, entityId, target } = config;

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

  /**
   * Forwards each server event through the reducer with the latest completion target and entity.
   * `useSSE` owns the Effect Event boundary, so this callback should remain a regular event handler.
   */
  function handleMessage(message: StepStreamMessage<TStep>) {
    handleStepStreamMessage({ completionStep, dispatch, entityId, message });
  }

  /**
   * Status streams are best-effort browser connections. Mobile browsers can
   * suspend or tear them down while the workflow keeps running on the server,
   * so a transport failure should resume the same run instead of being shown as
   * a failed generation.
   */
  function reconnectStream() {
    if (state.reconnectCount >= MAX_STREAM_RECONNECTS) {
      dispatch({ error: null, errorKind: "connection", type: "setError" });
      return;
    }

    setTimeout(() => {
      dispatch({ type: "reconnect" });
    }, 1000);
  }

  /**
   * When the SSE stream closes, check whether we received the expected completion
   * step. If not, the stream was likely cut off (e.g., Vercel function timeout)
   * while the workflow is still running. In that case, schedule a reconnection
   * instead of showing an error — the workflow library supports resumable streaming
   * via `startIndex`, so the next connection picks up where the previous one ended.
   */
  function handleComplete() {
    /**
     * If status is already "completed", handleStepStreamMessage already confirmed
     * both the completion step AND the entityId matched. No need to re-check
     * completedSteps (which doesn't track entityId and could match a different
     * lesson of the same kind).
     */
    const isComplete = state.status === "completed" || !completionStep;

    if (isComplete) {
      dispatch({ completionStep, type: "streamEnded" });
      return;
    }

    reconnectStream();
  }

  /**
   * Transport errors use the same bounded retry path as streams that end before completion.
   */
  function handleError() {
    reconnectStream();
  }

  /**
   * Include `_rc` (reconnect count) in the URL so that when `reconnectCount`
   * changes, React re-triggers the `useSSE` effect with a fresh connection.
   * The server ignores this parameter (Zod strips unknown keys).
   * `indexRef` inside `useSSE` persists across effect cycles, so the new
   * connection resumes from the last received message index.
   */
  const sseUrl =
    state.status === "streaming" && state.runId
      ? getGenerationEventsUrl({
          baseUrl: `${API_URL}/v1/generations`,
          generationId: state.runId,
          reconnectCount: state.reconnectCount,
        })
      : null;

  const { resetIndex } = useSSE<StepStreamMessage<TStep>>(sseUrl, {
    onComplete: handleComplete,
    onError: handleError,
    onMessage: handleMessage,
  });

  const startTrigger = useEffectEvent(async () => {
    dispatch({ type: "triggerStart" });

    try {
      const authHeaders = await getWorkflowAuthHeaders();

      const response = await fetch(
        `${API_URL}/v1/generations`,
        getGenerationTriggerRequest({ authHeaders, target }),
      );

      if (!response.ok) {
        throw new Error("Failed to start generation");
      }

      const data: unknown = await response.json();
      const generationId = getString(data, "id");

      if (!generationId) {
        throw new Error("Invalid response: missing generation ID");
      }

      dispatch({ runId: generationId, type: "triggerSuccess" });
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
    if (state.errorKind === "connection") {
      globalThis.location.reload();
      return;
    }

    hasTriggeredRef.current = false;
    resetIndex();
    dispatch({ type: "reset" });
  }, [resetIndex, state.errorKind]);

  return {
    completedSteps: state.completedSteps,
    completionEntityId: state.completionEntityId,
    currentStep: state.currentStep,
    error: state.error,
    errorKind: state.errorKind,
    retry,
    startedSteps: state.startedSteps,
    status: state.status,
  };
}
