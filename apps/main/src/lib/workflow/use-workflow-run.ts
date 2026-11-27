"use client";

import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { type FollowedRunProps } from "@zoonk/learn/generation/follower";
import { type GenerationRun } from "@zoonk/learn/generation/run";
import { safeAsync } from "@zoonk/utils/error";
import { getString } from "@zoonk/utils/json";
import { useEffect, useEffectEvent, useReducer, useState } from "react";
import {
  INITIAL_WORKFLOW_RUN_STATE,
  type RunLookup,
  type RunStatus,
  getFollowedRunId,
  getReplacedRunIds,
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

const LOOKUP_BY_RESPONSE_STATUS: Partial<Record<number, RunLookup>> = {
  404: "missing",
  503: "unavailable",
};

function toLookup(responseStatus: number | undefined): RunLookup | null {
  return responseStatus === undefined ? null : (LOOKUP_BY_RESPONSE_STATUS[responseStatus] ?? null);
}

async function readRunStatus(runId: string): Promise<RunLookup | null> {
  const headers = await getWorkflowAuthHeaders();
  const url = `${getBrowserApiUrl()}/v1/generations/${encodeURIComponent(runId)}`;
  const { data: response } = await safeAsync(() => fetch(url, { headers }));

  if (!response?.ok) {
    return toLookup(response?.status);
  }

  const { data } = await safeAsync<unknown>(() => response.json());
  const status = getString(data, "status");

  return isRunStatus(status) ? status : null;
}

export function useWorkflowRun({
  generationId,
  kind,
  onInterrupted,
  onReady,
  readGenerationId,
  restart,
}: Omit<FollowedRunProps, "children">): GenerationRun {
  const [state, dispatch] = useReducer(workflowRunReducer, INITIAL_WORKFLOW_RUN_STATE);
  const [confirmed, setConfirmed] = useState(generationId);

  if (generationId !== confirmed) {
    setConfirmed(generationId);
    const runIds = getReplacedRunIds({ confirmed: generationId, previous: confirmed, state });

    if (runIds) {
      dispatch({ runIds, type: "restart" });
    }
  }

  const runId = getFollowedRunId({ generationId, state });
  const status = getRunStatus({ runId, state });
  const isWaiting = status === "waiting";
  const canPoll = Boolean(readGenerationId);

  const poll = useEffectEvent(async () => {
    const { data } = await safeAsync(async () => (await readGenerationId?.()) ?? null);

    if (data && typeof data === "object") {
      dispatch({ namespace: data.namespace, runId: data.id, type: "polled" });
    } else {
      dispatch({ runId: data ?? null, type: "polled" });
    }
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
    if (!isWaiting || kind === "mockPaper") {
      return;
    }

    const timer = setTimeout(() => dispatch({ type: "notStarted" }), NOT_STARTED_MS);
    return () => clearTimeout(timer);
  }, [isWaiting, kind]);

  useEffect(() => {
    if (state.reconnectIn === null) {
      return;
    }

    const timer = setTimeout(() => dispatch({ type: "reconnect" }), state.reconnectIn);
    return () => clearTimeout(timer);
  }, [state.reconnectIn]);

  function applyLookup(id: string, lookup: RunLookup | null) {
    dispatch(
      lookup ? { runId: id, status: lookup, type: "runStatus" } : { type: "connectionLost" },
    );

    if (lookup !== "completed") {
      onInterrupted?.();
    }
  }

  async function checkRun(id: string) {
    applyLookup(id, await readRunStatus(id));
  }

  const isConnected =
    !state.ended &&
    state.failure === null &&
    (status === "following" || (status === "ready" && state.firstLesson?.status === "writing")) &&
    runId !== null &&
    state.reconnectIn === null;

  const checkStopped = useEffectEvent(async (id: string) => {
    const lookup = await readRunStatus(id);

    if (lookup === "failed" || lookup === "cancelled" || lookup === "missing") {
      applyLookup(id, lookup);
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
    namespace: runId === state.polled ? state.namespace : null,
    onComplete: (id) => void checkRun(id),
    onError: (responseStatus) => {
      if (runId) {
        applyLookup(runId, toLookup(responseStatus));
      }
    },
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
    ended: state.ended,
    failure: state.failure,
    firstLesson: state.firstLesson ?? undefined,
    id: runId,
    retry: getRetry(),
    skillName: state.skillName ?? undefined,
    status,
    stepTimes: state.stepTimes,
    steps: state.steps,
    warmUpId: state.warmUpId ?? undefined,
  };
}
