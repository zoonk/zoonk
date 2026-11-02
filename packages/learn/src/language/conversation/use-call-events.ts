"use client";

import { LIVE_CALL_NO_BACKEND_CUE } from "@zoonk/core/language/conversations/live-call-cues";
import { type Experimental_RealtimeServerEvent as RealtimeServerEvent } from "ai";
import { type RefObject, useCallback } from "react";
import { sendLiveCallCue } from "./live-call-commands";
import { type LiveCallSession } from "./live-call-session";
import { type TranscriptTurn, addTranscriptFragment } from "./live-call-transcript";
import { type LiveCallPhase } from "./use-call-controls";
import { type CallLength } from "./use-call-cues";

function movesCall({ event, phase }: { event: RealtimeServerEvent; phase: LiveCallPhase }) {
  if (phase === "live") {
    return true;
  }

  return (
    phase === "connecting" && (event.type === "session-started" || event.type === "session-closed")
  );
}

export function useCallEvents({
  hangUp,
  onCharacterTurn,
  onClosedEarly,
  onLearnerTurn,
  opening,
  phaseRef,
  sendWaitingReplies,
  sessionRef,
  setPhase,
  startClock,
  turnsRef,
  updateTurns,
}: {
  hangUp: () => void;
  onCharacterTurn: () => void;
  onClosedEarly: () => void;
  onLearnerTurn: () => void;
  opening: { cancel: () => void; open: (session: LiveCallSession) => void };
  phaseRef: RefObject<LiveCallPhase>;
  sendWaitingReplies: (session: LiveCallSession) => void;
  sessionRef: RefObject<LiveCallSession | null>;
  setPhase: (phase: LiveCallPhase) => void;
  startClock: (length: CallLength) => void;
  turnsRef: RefObject<TranscriptTurn[]>;
  updateTurns: (next: TranscriptTurn[]) => void;
}) {
  return useCallback(
    (created: LiveCallSession, event: RealtimeServerEvent, length: CallLength) => {
      const phase = phaseRef.current;

      if (sessionRef.current !== created || !movesCall({ event, phase })) {
        return;
      }

      if (event.type === "session-started" && phase === "connecting") {
        startClock(length);
        setPhase("live");
        opening.open(created);
        sendWaitingReplies(created);
      }

      if (event.type === "transcript-fragment") {
        const speaker = event.speaker === "user" ? "learner" : "character";
        const { delta, endMs, startMs } = event;
        updateTurns(addTranscriptFragment(turnsRef.current, { delta, endMs, speaker, startMs }));

        if (speaker === "learner") {
          onLearnerTurn();
        } else {
          opening.cancel();
          onCharacterTurn();
        }
      }

      if (event.type === "delegation-created") {
        sendLiveCallCue({
          channel: "thinking",
          content: LIVE_CALL_NO_BACKEND_CUE,
          delegationId: event.delegationId,
          session: created,
        });
      }

      if (event.type === "session-closed") {
        if (phase === "live") {
          hangUp();
        } else {
          onClosedEarly();
        }
      }
    },
    [
      hangUp,
      onCharacterTurn,
      onClosedEarly,
      onLearnerTurn,
      opening,
      phaseRef,
      sendWaitingReplies,
      sessionRef,
      setPhase,
      startClock,
      turnsRef,
      updateTurns,
    ],
  );
}
