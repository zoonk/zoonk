"use client";

import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { type GenerationKind } from "@zoonk/learn/generation/kinds";
import { type GenerationRun } from "@zoonk/learn/generation/run";
import { safeAsync } from "@zoonk/utils/error";
import { getString } from "@zoonk/utils/json";
import { useEffect, useEffectEvent, useReducer } from "react";
import {
  INITIAL_WORKFLOW_RUN_STATE,
  type RunStatus,
  getFollowedRunId,
  getRunStatus,
  workflowRunReducer,
} from "./_utils/workflow-run-state";
import { getWorkflowAuthHeaders } from "./auth-headers";
import { useGenerationEvents } from "./use-generation-events";

const ID_POLL_MS = 2000;
const NOT_STARTED_MS = 45_000;
/** A crash or a restart can leave a run's stream open; the API reports it failed once it stalls. */
const STATUS_CHECK_MS = 120_000;

const RUN_STATUSES = new Set<string>(["cancelled", "completed", "failed", "pending", "running"]);

function isRunStatus(value: string | null): value is RunStatus {
  return value !== null && RUN_STATUSES.has(value);
}

async function readRunStatus(runId: string): Promise<RunStatus | null> {
  const headers = await getWorkflowAuthHeaders();
  const url = `${getBrowserApiUrl()}/v1/generations/${encodeURIComponent(runId)}`;
  const { data: response } = await safeAsync(() => fetch(url, { headers }));

  if (!response?.ok) {
    return null;
  }

  const { data } = await safeAsync<unknown>(() => response.json());
  const status = getString(data, "status");

  return isRunStatus(status) ? status : null;
}

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

  async function checkRun(id: string) {
    const runStatus = await readRunStatus(id);
    dispatch(runStatus ? { status: runStatus, type: "runStatus" } : { type: "connectionLost" });
  }

  const isConnected = status === "following" && runId !== null && state.reconnectIn === null;

  const checkStopped = useEffectEvent(async (id: string) => {
    const runStatus = await readRunStatus(id);

    if (runStatus === "failed" || runStatus === "cancelled") {
      dispatch({ status: runStatus, type: "runStatus" });
    }
  });

  useEffect(() => {
    if (!isConnected || !runId) {
      return;
    }

    const timer = setInterval(() => void checkStopped(runId), STATUS_CHECK_MS);
    return () => clearInterval(timer);
  }, [isConnected, runId]);

  useGenerationEvents({
    connection: state.connection,
    onComplete: () => {
      if (runId) {
        void checkRun(runId);
      }
    },
    onError: () => dispatch({ type: "connectionLost" }),
    onMessage: (message) => dispatch({ kind, message, type: "event" }),
    onOpen: (response) => {
      const serverNow = Date.parse(response.headers.get("date") ?? "");

      if (Number.isFinite(serverNow)) {
        dispatch({ offsetMs: Date.now() - serverNow, type: "serverClock" });
      }
    },
    runId: isConnected ? runId : null,
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

  return {
    clockOffsetMs: state.clockOffsetMs ?? undefined,
    failure: state.failure,
    retry: getRetry(),
    status,
    stepTimes: state.stepTimes,
    steps: state.steps,
  };
}
