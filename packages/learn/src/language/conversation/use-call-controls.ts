"use client";

import { type LanguageConversationCompletionInput } from "@zoonk/core/language/conversations/contract";
import { formatTypedReplyCue } from "@zoonk/core/language/conversations/live-call-cues";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { sendLiveCallCue, setLiveCallMuted } from "./live-call-commands";
import { type LiveCallSession } from "./live-call-session";
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

/**
 * What a finished call saves: the connection it ran on (this run's own, never a newer one), what
 * was said and how long the learner spoke.
 */
type LiveCallSummary = Omit<LanguageConversationCompletionInput, "timeZone" | "usedHelp">;

/**
 * Asks the server to hang the call up, then returns what it saves, whether or not the hangup went
 * through: the review that completing starts hangs the call up itself before anything is reviewed,
 * and the deadline does if that fails too. Null only for a call that never got a connection.
 */
export function useCallFinish({
  getConnectionId,
  release,
  turnsRef,
}: {
  getConnectionId: () => string | null;
  release: () => Promise<boolean>;
  turnsRef: RefObject<TranscriptTurn[]>;
}) {
  return useCallback(async (): Promise<LiveCallSummary | null> => {
    const connectionId = getConnectionId();

    if (!connectionId) {
      return null;
    }

    await release();

    return {
      connectionId,
      spokenSeconds: getSpokenSeconds(turnsRef.current),
      turns: toConversationTurns(turnsRef.current),
    };
  }, [getConnectionId, release, turnsRef]);
}
