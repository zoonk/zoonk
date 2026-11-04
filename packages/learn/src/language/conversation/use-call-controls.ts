"use client";

import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { sendLiveCallCue, setLiveCallMuted } from "./live-call-commands";
import { type LiveCallScript, toTypedReplyCue } from "./live-call-script";
import { type LiveCallSession } from "./live-call-session";
import { type CallSoFar, toCallCompletion } from "./live-call-so-far";
import { type TranscriptTurn, addTypedReply, toConversationTurns } from "./live-call-transcript";

export type LiveCallPhase = "connecting" | "ended" | "failed" | "idle" | "live";

export function useCallPhase() {
  const [current, setCurrent] = useState<LiveCallPhase>("idle");
  const phaseRef = useRef<LiveCallPhase>("idle");

  const setPhase = useCallback((next: LiveCallPhase) => {
    phaseRef.current = next;
    setCurrent(next);
  }, []);

  return { phase: current, phaseRef, setPhase };
}

export function useCallTranscript(earlier: TranscriptTurn[]) {
  const [turns, setTurns] = useState(earlier);
  const turnsRef = useRef(earlier);
  const getTurns = useCallback(() => toConversationTurns(turnsRef.current), []);
  const savedTurns = useMemo(() => toConversationTurns(turns), [turns]);

  const updateTurns = useCallback((next: TranscriptTurn[]) => {
    turnsRef.current = next;
    setTurns(next);
  }, []);

  return { getTurns, savedTurns, turnsRef, updateTurns };
}

/** Replies typed while the call rings go out once it's live. */
export function useTypedReplies({
  isConnecting,
  onSent,
  script,
  session,
  turnsRef,
  updateTurns,
}: {
  isConnecting: boolean;
  onSent: () => void;
  script: LiveCallScript | null;
  session: LiveCallSession | null;
  turnsRef: RefObject<TranscriptTurn[]>;
  updateTurns: (next: TranscriptTurn[]) => void;
}) {
  const waiting = useRef<string[]>([]);

  const sendWaitingReplies = useCallback(
    (live: LiveCallSession, length: { script: LiveCallScript }) => {
      for (const text of waiting.current) {
        sendLiveCallCue({ cue: toTypedReplyCue(length.script, text), session: live });
      }

      waiting.current = [];
    },
    [],
  );

  const sendText = useCallback(
    (text: string) => {
      if (!(script && session) && !isConnecting) {
        return;
      }

      updateTurns(addTypedReply(turnsRef.current, text));

      if (script && session) {
        sendLiveCallCue({ cue: toTypedReplyCue(script, text), session });
      } else {
        waiting.current = [...waiting.current, text];
      }

      onSent();
    },
    [isConnecting, onSent, script, session, turnsRef, updateTurns],
  );

  return { sendText, sendWaitingReplies };
}

export function useCallMute(liveSession: LiveCallSession | null) {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  const toggleMute = useCallback(() => {
    if (!liveSession) {
      return;
    }

    setLiveCallMuted({ muted: !mutedRef.current, session: liveSession });
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
  }, [liveSession]);

  return { muted, mutedRef, toggleMute };
}

/**
 * Returns what it saves whether or not the hangup went through: completing hangs the call up
 * itself, and the deadline does if that fails too.
 */
export function useCallFinish({
  getCallSoFar,
  release,
  settle,
}: {
  getCallSoFar: () => CallSoFar;
  release: () => Promise<boolean>;
  settle: () => Promise<unknown>;
}) {
  return useCallback(async () => {
    await settle();
    await release();
    return toCallCompletion(getCallSoFar());
  }, [getCallSoFar, release, settle]);
}
