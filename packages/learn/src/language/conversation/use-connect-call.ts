"use client";

import { type ConversationTurn } from "@zoonk/core/language/conversations/contract";
import { type Experimental_RealtimeServerEvent as RealtimeServerEvent } from "ai";
import { type RefObject, useCallback, useRef } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { type CallLength } from "./live-call-clock";
import { type LiveCallError, openCall, toConnectionError } from "./live-call-lifecycle";
import { type LiveCallSession } from "./live-call-session";
import { type SpeechSample } from "./speech-activity";
import { type LiveCallSetup, type useCallConnection } from "./use-call-connection";
import { type LiveCallPhase } from "./use-call-controls";
import {
  type CallAudio,
  type MicrophoneProblem,
  type TappedCallAudio,
} from "./use-call-microphone";

type Connection = ReturnType<typeof useCallConnection>;

/**
 * `cancelStart` drops a start still on its way, whatever it was waiting for. `prepare` turns the
 * server's answer into the call's length and the turns its offer carries.
 */
export function useConnectCall({
  endAtDeadline,
  endedByServer,
  fail,
  handleEvent,
  hear,
  keepAudio,
  keepSession,
  onMicrophoneProblem,
  onReserved,
  phaseRef,
  prepare,
  reserve,
  setPhase,
  stopEnding,
  tappedAudio,
}: {
  endAtDeadline: () => void;
  endedByServer: Connection["endedByServer"];
  fail: (error: LiveCallError, limit?: CallLimit | null) => void;
  handleEvent: (session: LiveCallSession, event: RealtimeServerEvent, length: CallLength) => void;
  hear: (sample: SpeechSample) => void;
  keepAudio: (audio: CallAudio) => boolean;
  keepSession: (session: LiveCallSession) => void;
  onMicrophoneProblem: (problem: MicrophoneProblem) => void;
  onReserved: (talkSeconds: number) => void;
  phaseRef: RefObject<LiveCallPhase>;
  prepare: (
    setup: LiveCallSetup,
    answeredAt: number,
  ) => { length: CallLength; turns: ConversationTurn[] };
  reserve: Connection["reserve"];
  setPhase: (phase: LiveCallPhase) => void;
  stopEnding: () => void;
  tappedAudio?: TappedCallAudio;
}) {
  const attempt = useRef(0);

  const start = useCallback(
    async ({
      audio = null,
      takeover = false,
    }: {
      audio?: CallAudio | null;
      takeover?: boolean;
    }) => {
      const mine = attempt.current + 1;
      attempt.current = mine;
      const isCurrent = () => attempt.current === mine;

      setPhase("connecting");
      const given = audio ?? tappedAudio?.take() ?? null;
      const opened = await openCall({ audio: given, isCurrent, keepAudio });

      if (!opened) {
        return;
      }

      if (typeof opened === "string") {
        setPhase("idle");
        onMicrophoneProblem(opened);
        return;
      }

      if (!opened.live) {
        fail("connect");
        return;
      }

      opened.audio.hear(hear);
      const answer = await reserve({ isCurrent, takeover });

      if (!answer || !isCurrent()) {
        return;
      }

      if (answer.status !== "ready") {
        fail(toConnectionError(answer.status), "limit" in answer ? answer.limit : null);
        return;
      }

      const { setup } = answer;
      onReserved(setup.talkSeconds);
      const { length, turns } = prepare(setup, Date.now());

      const created: LiveCallSession = opened.live.createLiveCallSession({
        onEvent: (event) => handleEvent(created, event, length),
        sessionUrl: setup.sessionUrl,
        turns,
      });

      opened.live.watchConnection({
        endedByServer,
        isOpen: () => phaseRef.current === "connecting" || phaseRef.current === "live",
        onClosed: stopEnding,
        onEnded: endAtDeadline,
        onLost: () => fail(phaseRef.current === "live" ? "dropped" : "connect"),
        session: created,
      });

      keepSession(created);
      // Failures arrive via the session's state (`watchConnection`); only a second connect rejects.
      void created.connect({ stream: opened.audio.stream }).catch(() => null);
    },
    [
      endAtDeadline,
      endedByServer,
      fail,
      handleEvent,
      hear,
      keepAudio,
      keepSession,
      onMicrophoneProblem,
      onReserved,
      phaseRef,
      prepare,
      reserve,
      setPhase,
      stopEnding,
      tappedAudio,
    ],
  );

  const cancelStart = useCallback(() => {
    attempt.current += 1;
  }, []);

  /** A reconnect stopped while it rings leaves the call dropped, to end or call again. */
  const dropStart = useCallback(() => {
    attempt.current += 1;
    fail("dropped");
  }, [fail]);

  return { cancelStart, dropStart, start };
}
