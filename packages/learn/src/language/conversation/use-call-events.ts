"use client";

import { LIVE_CALL_NO_BACKEND_CUE } from "@zoonk/core/language/conversations/live-call-cues";
import { type Experimental_RealtimeServerEvent as RealtimeServerEvent } from "ai";
import { type RefObject, useCallback } from "react";
import { sendLiveCallCue } from "./live-call-commands";
import { type LiveCallSession } from "./live-call-session";
import { type TranscriptTurn, addTranscriptFragment } from "./live-call-transcript";
import { type LiveCallPhase } from "./use-call-controls";
import { type CallLength } from "./use-call-cues";

/** Before the call is live, only its start, or the server closing it early, means anything. */
function movesCall({ event, phase }: { event: RealtimeServerEvent; phase: LiveCallPhase }) {
  if (phase === "live") {
    return true;
  }

  return (
    phase === "connecting" && (event.type === "session-started" || event.type === "session-closed")
  );
}

/**
 * What the call does with GPT-Live's events. Once the session starts, the clock runs to the call's
 * end, the character opens, and replies typed while it connected go out. Transcripts build what was
 * said and time the goal checks; a delegation is told there's no backend to ask. A session our
 * server closed (its deadline, another call taking over, an admin) ends the call here as well, or,
 * closed before it went live, is a call that didn't connect (`onClosedEarly`). Only the run's own
 * session moves it, and only while that's meant to: a session that starts after the call failed or
 * ended can't bring it back, and words after the end (which the learner no longer hears) don't join
 * what's saved.
 */
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
