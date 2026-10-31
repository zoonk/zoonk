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

export function useCallPhase() {
  const [current, setCurrent] = useState<LiveCallPhase>("idle");
  const phaseRef = useRef<LiveCallPhase>("idle");

  const setPhase = useCallback((next: LiveCallPhase) => {
    phaseRef.current = next;
    setCurrent(next);
  }, []);

  return { phase: current, phaseRef, setPhase };
}

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

export function useTypedReplies({
  isConnecting,
  liveSession,
  onLearnerTurn,
  turnsRef,
  updateTurns,
}: {
  isConnecting: boolean;
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

type LiveCallSummary = Omit<LanguageConversationCompletionInput, "timeZone" | "usedHelp">;

/**
 * Returns what it saves whether or not the hangup went through: completing hangs the call up
 * itself, and the deadline does if that fails too.
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
