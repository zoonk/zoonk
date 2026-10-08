"use client";

import { type ConversationTurn } from "@zoonk/core/language/conversations/contract";
import { formatTypedReplyCue } from "@zoonk/core/language/conversations/live-call-cues";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { type LiveCallSession, sendLiveCallCue, setLiveCallMuted } from "./live-call-session";
import {
  type TranscriptTurn,
  addTypedReply,
  getSpokenSeconds,
  toConversationTurns,
} from "./live-call-transcript";

export type LiveCallPhase = "connecting" | "ended" | "failed" | "idle" | "live";

/**
 * Where the call is. The connection's own events read the ref, so they act on the phase of the
 * moment, not the one they were created in.
 */
export function useCallPhase() {
  const [current, setCurrent] = useState<LiveCallPhase>("idle");
  const phaseRef = useRef<LiveCallPhase>("idle");

  const setPhase = useCallback((next: LiveCallPhase) => {
    phaseRef.current = next;
    setCurrent(next);
  }, []);

  return { phase: current, phaseRef, setPhase };
}

/**
 * What was said so far, as it builds up: the ref holds the latest turns for the call's event
 * handlers, the state renders them.
 */
export function useCallTranscript() {
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const turnsRef = useRef<TranscriptTurn[]>([]);
  const getTurns = useCallback(() => toConversationTurns(turnsRef.current), []);
  const savedTurns = useMemo(() => toConversationTurns(turns), [turns]);

  const updateTurns = useCallback((next: TranscriptTurn[]) => {
    turnsRef.current = next;
    setTurns(next);
  }, []);

  return { getTurns, savedTurns, turnsRef, updateTurns };
}

/**
 * Replies the learner types: each one joins the transcript at once. While the call connects they
 * wait, and go out once the call is live; then each goes straight to GPT-Live.
 */
export function useTypedReplies({
  isConnecting,
  liveSession,
  onLearnerTurn,
  turnsRef,
  updateTurns,
}: {
  isConnecting: boolean;
  /** The session while the call is live; null before and after. */
  liveSession: LiveCallSession | null;
  onLearnerTurn: () => void;
  turnsRef: RefObject<TranscriptTurn[]>;
  updateTurns: (next: TranscriptTurn[]) => void;
}) {
  const waiting = useRef<string[]>([]);

  const sendWaitingReplies = useCallback((session: LiveCallSession) => {
    for (const text of waiting.current) {
      sendLiveCallCue({ content: formatTypedReplyCue(text), session });
    }

    waiting.current = [];
  }, []);

  const sendText = useCallback(
    (text: string) => {
      if (!liveSession && !isConnecting) {
        return;
      }

      updateTurns(addTypedReply(turnsRef.current, text));
      onLearnerTurn();

      if (liveSession) {
        sendLiveCallCue({ content: formatTypedReplyCue(text), session: liveSession });
      } else {
        waiting.current = [...waiting.current, text];
      }
    },
    [isConnecting, liveSession, onLearnerTurn, turnsRef, updateTurns],
  );

  return { sendText, sendWaitingReplies };
}

/** The big microphone button mutes the learner during a live call, and unmutes them. */
export function useCallMute(liveSession: LiveCallSession | null) {
  const [muted, setMuted] = useState(false);

  const toggleMute = useCallback(() => {
    if (!liveSession) {
      return;
    }

    setLiveCallMuted({ muted: !muted, session: liveSession });
    setMuted(!muted);
  }, [liveSession, muted]);

  return { muted, toggleMute };
}

/** What a finished call saves: what was said, how long the learner spoke, and the billed session. */
type LiveCallSummary = { spokenSeconds: number; turns: ConversationTurn[]; voiceSeconds?: number };

/** Waits for GPT-Live to confirm the call closed, then returns what the call saves. */
export function useCallFinish({
  closing,
  session,
  stopAudio,
  turnsRef,
}: {
  closing: RefObject<Promise<unknown> | null>;
  session: LiveCallSession | null;
  stopAudio: () => void;
  turnsRef: RefObject<TranscriptTurn[]>;
}) {
  return async (): Promise<LiveCallSummary> => {
    await closing.current;
    stopAudio();
    const voiceSeconds = session?.getSnapshot().session?.usage?.seconds;

    return {
      spokenSeconds: getSpokenSeconds(turnsRef.current),
      turns: toConversationTurns(turnsRef.current),
      ...(voiceSeconds === undefined ? {} : { voiceSeconds: Math.round(voiceSeconds) }),
    };
  };
}
