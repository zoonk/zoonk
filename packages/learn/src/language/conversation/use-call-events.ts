"use client";

import { getNumber } from "@zoonk/utils/json";
import { type Experimental_RealtimeServerEvent as RealtimeServerEvent } from "ai";
import { type RefObject, useCallback } from "react";
import { sendLiveCallCue } from "./live-call-commands";
import { type CallEndingEvent } from "./live-call-ending";
import { type LiveCallSession } from "./live-call-session";
import { type TranscriptTurn, addTranscriptFragment } from "./live-call-transcript";
import { type LiveCallPhase } from "./use-call-controls";
import { type CallLength } from "./use-call-ending";

function movesCall({ event, phase }: { event: RealtimeServerEvent; phase: LiveCallPhase }) {
  if (phase === "live") {
    return true;
  }

  return (
    phase === "connecting" && (event.type === "session-started" || event.type === "session-closed")
  );
}

export function useCallEvents({
  begin,
  dispatch,
  hangUp,
  onCharacterTurn,
  onClosedEarly,
  onDelegation,
  onLearnerTurn,
  phaseRef,
  sendWaitingReplies,
  sessionRef,
  setPhase,
  turnsRef,
  updateTurns,
}: {
  begin: (session: LiveCallSession, length: CallLength) => void;
  dispatch: (event: CallEndingEvent) => void;
  hangUp: () => void;
  onCharacterTurn: (at: number) => void;
  onClosedEarly: () => void;
  onDelegation: () => void;
  onLearnerTurn: () => void;
  phaseRef: RefObject<LiveCallPhase>;
  sendWaitingReplies: (session: LiveCallSession, length: CallLength) => void;
  sessionRef: RefObject<LiveCallSession | null>;
  setPhase: (phase: LiveCallPhase) => void;
  turnsRef: RefObject<TranscriptTurn[]>;
  updateTurns: (next: TranscriptTurn[]) => void;
}) {
  return useCallback(
    (created: LiveCallSession, event: RealtimeServerEvent, length: CallLength) => {
      const phase = phaseRef.current;
      const at = Date.now();

      if (sessionRef.current !== created || !movesCall({ event, phase })) {
        return;
      }

      if (event.type === "session-started" && phase === "connecting") {
        setPhase("live");
        begin(created, length);
        sendWaitingReplies(created, length);
      }

      if (event.type === "transcript-fragment") {
        const speaker = event.speaker === "user" ? "learner" : "character";
        const { delta, endMs, startMs } = event;
        updateTurns(addTranscriptFragment(turnsRef.current, { delta, endMs, speaker, startMs }));

        if (speaker === "learner") {
          onLearnerTurn();
          dispatch({ at, type: "learnerHeard" });
        } else {
          onCharacterTurn(at);
          dispatch({ at, startMs, type: "characterSpoke" });
        }
      }

      if (event.type === "command-acknowledged" && event.clientEventId) {
        dispatch({
          at,
          id: event.clientEventId,
          startMs: getNumber(event.raw, "start_ms"),
          type: "acknowledged",
        });
      }

      if (event.type === "delegation-created") {
        onDelegation();

        sendLiveCallCue({
          cue: length.script.cues.noBackend,
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
      begin,
      dispatch,
      hangUp,
      onCharacterTurn,
      onClosedEarly,
      onDelegation,
      onLearnerTurn,
      phaseRef,
      sendWaitingReplies,
      sessionRef,
      setPhase,
      turnsRef,
      updateTurns,
    ],
  );
}
