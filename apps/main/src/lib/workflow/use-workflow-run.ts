"use client";

import { type StepStreamMessage } from "@zoonk/core/workflows/steps";
import { type GenerationKind } from "@zoonk/learn/generation/kinds";
import { type GenerationRun } from "@zoonk/learn/generation/run";
import { safeAsync } from "@zoonk/utils/error";
import { getString } from "@zoonk/utils/json";
import { API_URL } from "@zoonk/utils/url";
import { useEffect, useEffectEvent, useReducer } from "react";
import { getGenerationEventsUrl } from "./_utils/generation-events-url";
import {
  INITIAL_WORKFLOW_RUN_STATE,
  type RunStatus,
  getFollowedRunId,
  getRunStatus,
  workflowRunReducer,
} from "./_utils/workflow-run-state";
import { getWorkflowAuthHeaders } from "./auth-headers";
import { useSSE } from "./use-sse";

/** A run saves its id within a few seconds of starting; the page asks for it this often. */
const ID_POLL_MS = 2000;
/** With no run after this long, the start failed: the learner can start it again. */
const NOT_STARTED_MS = 45_000;

const RUN_STATUSES = new Set<string>(["cancelled", "completed", "failed", "pending", "running"]);

function isRunStatus(value: string | null): value is RunStatus {
  return value !== null && RUN_STATUSES.has(value);
}

/** The workflow's own status for a run, or null when the API couldn't be reached. */
async function readRunStatus(runId: string): Promise<RunStatus | null> {
  const headers = await getWorkflowAuthHeaders();
  const url = `${API_URL}/v1/generations/${encodeURIComponent(runId)}`;
  const { data: response } = await safeAsync(() => fetch(url, { headers }));

  if (!response?.ok) {
    return null;
  }

  const { data } = await safeAsync<unknown>(() => response.json());
  const status = getString(data, "status");

  return isRunStatus(status) ? status : null;
}

/**
 * Follows the run behind a generation wait until its content is ready, for `GenerationWait`. It
 * only reads: the host starts runs (a learner's tap, never a page load) and passes the run's id,
 * or `readGenerationId` to ask for it until the run saved it. Events stream live and resume after
 * a dropped connection; a run that hands over to another is followed there. It never gives up
 * silently: no run within 45 seconds, a connection that keeps dropping, or a failed run each
 * become a failure with the way out (`retry`): reconnecting to the same run, or starting it again
 * through `restart`, which may return the new run's id (null when the start failed). `onReady`
 * runs once the content is ready.
 */
export function useWorkflowRun({
  generationId,
  kind,
  onReady,
  readGenerationId,
  restart,
}: {
  generationId: string | null;
  kind: GenerationKind;
  onReady?: () => void;
  readGenerationId?: () => Promise<string | null>;
  restart: () => Promise<unknown>;
}): GenerationRun {
  const [state, dispatch] = useReducer(workflowRunReducer, INITIAL_WORKFLOW_RUN_STATE);
  const runId = getFollowedRunId({ generationId, state });
  const status = getRunStatus({ runId, state });
  const isWaiting = status === "waiting";
  const canPoll = Boolean(readGenerationId);

  const poll = useEffectEvent(async () => {
    const { data } = await safeAsync(async () => (await readGenerationId?.()) ?? null);
    dispatch({ runId: data ?? null, type: "polled" });
  });

  useEffect(() => {
    if (!isWaiting || !canPoll) {
      return;
    }

    void poll();
    const timer = setInterval(() => void poll(), ID_POLL_MS);
    return () => clearInterval(timer);
  }, [canPoll, isWaiting]);

  useEffect(() => {
    if (!isWaiting) {
      return;
    }

    const timer = setTimeout(() => dispatch({ type: "notStarted" }), NOT_STARTED_MS);
    return () => clearTimeout(timer);
  }, [isWaiting]);

  useEffect(() => {
    if (state.reconnectIn === null) {
      return;
    }

    const timer = setTimeout(() => dispatch({ type: "reconnect" }), state.reconnectIn);
    return () => clearTimeout(timer);
  }, [state.reconnectIn]);

  /** A closed stream: the run's own status says whether to reopen it, or how it ended. */
  async function checkRun(id: string) {
    const runStatus = await readRunStatus(id);
    dispatch(runStatus ? { status: runStatus, type: "runStatus" } : { type: "connectionLost" });
  }

  const isConnected = status === "following" && runId !== null && state.reconnectIn === null;

  const url =
    isConnected && runId
      ? getGenerationEventsUrl({
          baseUrl: `${API_URL}/v1/generations`,
          generationId: runId,
          reconnectCount: state.connection,
        })
      : null;

  useSSE<StepStreamMessage>(url, {
    onComplete: () => {
      if (runId) {
        void checkRun(runId);
      }
    },
    onError: () => dispatch({ type: "connectionLost" }),
    onMessage: (message) => dispatch({ kind, message, type: "event" }),
    resumeKey: runId,
  });

  const notifyReady = useEffectEvent(() => onReady?.());

  useEffect(() => {
    if (status === "ready") {
      notifyReady();
    }
  }, [status]);

  async function startAgain() {
    const runIds = [state.joined, state.polled, generationId].filter((id) => id !== null);
    dispatch({ runIds, type: "restart" });

    const { data, error } = await safeAsync(restart);

    // A host that knows its start failed says so with null: no need to wait for a run.
    if (error || data === null) {
      dispatch({ type: "notStarted" });
      return;
    }

    if (typeof data === "string") {
      dispatch({ runId: data, type: "polled" });
    }
  }

  function getRetry(): (() => void) | undefined {
    if (state.failure === "connection") {
      return () => dispatch({ type: "resume" });
    }

    return state.failure ? () => void startAgain() : undefined;
  }

  return { failure: state.failure, retry: getRetry(), status, steps: state.steps };
}
