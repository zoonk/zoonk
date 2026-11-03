"use client";

import { type RefObject, useCallback, useRef, useState } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { type LiveCallSession } from "./live-call-session";
import { loadLiveCallSession } from "./load-live-call-session";
import { type ConversationConnection } from "./use-call-connection";
import { type LiveCallPhase } from "./use-call-controls";
import { type CallAudio, openCallAudio } from "./use-call-microphone";

export type LiveCallError =
  | "callInProgress"
  | "callsPaused"
  | "connect"
  | "dropped"
  | "ended"
  | "limit"
  | "plusRequired";

/**
 * The microphone opens before the call is reserved, since the server's deadline starts then and a
 * permission prompt would take its time. Null when the start was cancelled meanwhile, `blocked`
 * when the microphone is: only the learner chooses a typed call.
 */
export async function openCall({
  audio,
  isCurrent,
  keepAudio,
}: {
  audio: CallAudio | null;
  isCurrent: () => boolean;
  keepAudio: (audio: CallAudio) => boolean;
}) {
  const live = loadLiveCallSession();
  const opened = audio ?? (await openCallAudio());

  if (!opened) {
    return isCurrent() ? ("blocked" as const) : null;
  }

  if (!isCurrent()) {
    opened.stop();
    return null;
  }

  if (!keepAudio(opened)) {
    return null;
  }

  const loaded = await live;
  return isCurrent() ? { audio: opened, live: loaded } : null;
}

export function toConnectionError(
  status: Exclude<ConversationConnection["status"], "ready">,
): LiveCallError {
  if (status === "failed" || status === "previousConnectionClosing") {
    return "connect";
  }

  return status;
}

export function useCallProblem({
  phase,
  release,
  setPhase,
}: {
  phase: LiveCallPhase;
  release: () => Promise<boolean>;
  setPhase: (phase: LiveCallPhase) => void;
}) {
  const [problem, setProblem] = useState<{ error: LiveCallError; limit: CallLimit | null } | null>(
    null,
  );

  const fail = useCallback(
    (error: LiveCallError, limit: CallLimit | null = null) => {
      void release();
      setProblem({ error, limit });
      setPhase("failed");
    },
    [release, setPhase],
  );

  const shown = phase === "failed" ? problem : null;

  return { error: shown?.error ?? null, fail, limit: shown?.limit ?? null };
}

/**
 * `release` resolves true once OpenAI confirmed the session is over; only then does the browser
 * drop its peer.
 */
export function useCallRelease({
  endConnection,
  sessionRef,
  setPhase,
  stopAudio,
}: {
  endConnection: () => Promise<boolean>;
  sessionRef: RefObject<LiveCallSession | null>;
  setPhase: (phase: LiveCallPhase) => void;
  stopAudio: () => void;
}) {
  const silence = useCallback(() => {
    stopAudio();
    sessionRef.current?.silence();
  }, [sessionRef, stopAudio]);

  const release = useCallback(async () => {
    silence();
    const closed = await endConnection();

    if (closed) {
      sessionRef.current?.dispose();
    }

    return closed;
  }, [endConnection, sessionRef, silence]);

  const hangUp = useCallback(() => {
    silence();
    setPhase("ended");
  }, [setPhase, silence]);

  return { hangUp, release };
}

export function useCallSession() {
  const [session, setSession] = useState<LiveCallSession | null>(null);
  const sessionRef = useRef<LiveCallSession | null>(null);

  const keepSession = useCallback((created: LiveCallSession) => {
    sessionRef.current = created;
    setSession(created);
  }, []);

  return { keepSession, session, sessionRef };
}
