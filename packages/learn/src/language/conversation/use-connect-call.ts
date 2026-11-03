"use client";

import { type Experimental_RealtimeServerEvent as RealtimeServerEvent } from "ai";
import { type RefObject, useCallback, useRef } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { type LiveCallError, openCall, toConnectionError } from "./live-call-lifecycle";
import { type LiveCallSession } from "./live-call-session";
import { type SpeechSample } from "./speech-activity";
import { type useCallConnection } from "./use-call-connection";
import { type LiveCallPhase } from "./use-call-controls";
import { type CallLength } from "./use-call-ending";
import { type CallAudio, type TappedCallAudio } from "./use-call-microphone";

const MS_PER_SECOND = 1000;

type Connection = ReturnType<typeof useCallConnection>;

/**
 * Opens the microphone, reserves the call and connects its session. `cancelStart` drops a start
 * still on its way, whatever it was waiting for.
 */
export function useConnectCall({
  endAtDeadline,
  endedByServer,
  fail,
  handleEvent,
  hear,
  keepAudio,
  keepSession,
  onReserved,
  phaseRef,
  reserve,
  setPhase,
  tappedAudio,
}: {
  endAtDeadline: () => void;
  endedByServer: Connection["endedByServer"];
  fail: (error: LiveCallError, limit?: CallLimit | null) => void;
  handleEvent: (session: LiveCallSession, event: RealtimeServerEvent, length: CallLength) => void;
  hear: (sample: SpeechSample) => void;
  keepAudio: (audio: CallAudio) => boolean;
  keepSession: (session: LiveCallSession) => void;
  onReserved: (talkSeconds: number) => void;
  phaseRef: RefObject<LiveCallPhase>;
  reserve: Connection["reserve"];
  setPhase: (phase: LiveCallPhase) => void;
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
      const answeredAt = Date.now();
      onReserved(setup.talkSeconds);

      // `seconds` is when the server hangs up; `talkSeconds` when the call starts ending.
      const length: CallLength = {
        endsAtLimit: setup.endsAtLimit,
        hardStopAt: answeredAt + setup.seconds * MS_PER_SECOND,
        script: setup.script,
        talkEndsAt: answeredAt + setup.talkSeconds * MS_PER_SECOND,
        talkSeconds: setup.talkSeconds,
      };

      const created: LiveCallSession = opened.live.createLiveCallSession({
        onEvent: (event) => handleEvent(created, event, length),
        sessionUrl: setup.sessionUrl,
      });

      opened.live.watchConnection({
        endedByServer,
        isOpen: () => phaseRef.current === "connecting" || phaseRef.current === "live",
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
      onReserved,
      phaseRef,
      reserve,
      setPhase,
      tappedAudio,
    ],
  );

  const cancelStart = useCallback(() => {
    attempt.current += 1;
  }, []);

  return { cancelStart, start };
}
