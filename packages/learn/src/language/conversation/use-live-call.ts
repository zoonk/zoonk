"use client";

import {
  type ConversationTurn,
  type LanguageConversationObjectiveCheck,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { type RefObject, useCallback, useEffect, useMemo, useState } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { type CallEndingEvent } from "./live-call-ending";
import {
  type LiveCallError,
  useCallProblem,
  useCallRelease,
  useCallSession,
} from "./live-call-lifecycle";
import { type ReplyGapEvent } from "./live-call-report";
import { type LiveCallSession } from "./live-call-session";
import { type SpeechSample } from "./speech-activity";
import { type CallConnectionActions, useCallConnection } from "./use-call-connection";
import {
  useCallFinish,
  useCallMute,
  useCallPhase,
  useCallTranscript,
  useTypedReplies,
} from "./use-call-controls";
import { type CallLength, useCallEnding } from "./use-call-ending";
import { useCallEvents } from "./use-call-events";
import { type TappedCallAudio, useCallMicrophone } from "./use-call-microphone";
import { type CallEndReason, type CallReport, useCallReport } from "./use-call-report";
import { useConnectCall } from "./use-connect-call";
import { useCallObjectives } from "./use-objective-checks";

export type LiveCallActions = CallConnectionActions & {
  /** Null when the check didn't run. */
  checkObjectives: (
    turns: ConversationTurn[],
  ) => Promise<LanguageConversationObjectiveCheck | null>;
};

function useLearnerInput({
  dispatch,
  mutedRef,
  onLearnerTurn,
  record,
}: {
  dispatch: (event: CallEndingEvent) => void;
  mutedRef: RefObject<boolean>;
  onLearnerTurn: () => void;
  record: (event: ReplyGapEvent) => void;
}) {
  const hear = useCallback(
    ({ at, speaking, voiced }: SpeechSample) => {
      const muted = mutedRef.current;
      dispatch({ at, speaking: speaking && !muted, type: "speech" });

      if (voiced && !muted) {
        record({ at, type: "voice" });
      }
    },
    [dispatch, mutedRef, record],
  );

  const onSent = useCallback(() => {
    onLearnerTurn();
    record({ type: "cue" });
    dispatch({ at: Date.now(), type: "sent" });
  }, [dispatch, onLearnerTurn, record]);

  const onTyping = useCallback(() => dispatch({ at: Date.now(), type: "typing" }), [dispatch]);

  return { hear, onSent, onTyping };
}

function useLiveCallEvents({
  begin,
  endAtDeadline,
  fail,
  objectives,
  report,
  ...events
}: {
  begin: (session: LiveCallSession, length: CallLength) => void;
  endAtDeadline: () => void;
  fail: (error: LiveCallError) => void;
  objectives: {
    onCharacterTurn: (startMs: number) => void;
    onLearnerTurn: (startMs?: number) => void;
  };
  report: CallReport;
} & Pick<
  Parameters<typeof useCallEvents>[0],
  | "dispatch"
  | "phaseRef"
  | "sendWaitingReplies"
  | "sessionRef"
  | "setPhase"
  | "turnsRef"
  | "updateTurns"
>) {
  const { onCharacterTurn, onLearnerTurn } = objectives;

  return useCallEvents({
    ...events,
    begin: useCallback(
      (created: LiveCallSession, length: CallLength) => {
        report.live();
        begin(created, length);
      },
      [begin, report],
    ),
    hangUp: endAtDeadline,
    onCharacterTurn: useCallback(
      ({ at, startMs }: { at: number; startMs: number }) => {
        onCharacterTurn(startMs);
        report.record({ at, type: "character" });
      },
      [onCharacterTurn, report],
    ),
    onClosedEarly: useCallback(() => fail("connect"), [fail]),
    onDelegation: useCallback(() => report.record({ type: "delegation" }), [report]),
    onLearnerTurn,
  });
}

export function useLiveCall({
  actions,
  conversation,
  tappedAudio,
}: {
  actions: LiveCallActions;
  conversation: LanguageConversationView;
  tappedAudio?: TappedCallAudio;
}) {
  const { keepSession, session, sessionRef } = useCallSession();
  const { phase, phaseRef, setPhase } = useCallPhase();
  const { getTurns, savedTurns, turnsRef, updateTurns } = useCallTranscript();
  const microphone = useCallMicrophone();
  const connection = useCallConnection(actions);
  const report = useCallReport({ kind: conversation.kind, turnsRef });

  const { hangUp, release } = useCallRelease({
    endConnection: connection.end,
    sessionRef,
    setPhase,
    stopAudio: microphone.stop,
  });

  const endAs = useCallback(
    (reason: CallEndReason) => {
      report.send(reason);
      hangUp();
    },
    [hangUp, report],
  );

  const ending = useCallEnding({
    examCues: conversation.examTask?.cues,
    onCue: useCallback(() => report.record({ type: "cue" }), [report]),
    onHangUp: endAs,
  });

  const stopEnding = ending.stop;

  const endFromOutside = useCallback(
    (reason: CallEndReason) => {
      stopEnding();
      endAs(reason);
    },
    [endAs, stopEnding],
  );

  const objectives = useCallObjectives({
    checkObjectives: actions.checkObjectives,
    conversation,
    getTurns,
    onResult: ending.checked,
  });

  const liveSession = phase === "live" ? session : null;
  const { muted, mutedRef, toggleMute } = useCallMute(liveSession);
  const problem = useCallProblem({ phase, release, setPhase });
  const failCall = problem.fail;

  const fail = useCallback(
    (error: LiveCallError, limit: CallLimit | null = null) => {
      stopEnding();
      report.send(error === "dropped" ? "dropped" : "failed");
      failCall(error, limit);
    },
    [failCall, report, stopEnding],
  );

  const input = useLearnerInput({
    dispatch: ending.dispatch,
    mutedRef,
    onLearnerTurn: objectives.onLearnerTurn,
    record: report.record,
  });

  const typedLive = useMemo(
    () =>
      liveSession && ending.callLength
        ? { script: ending.callLength.script, session: liveSession }
        : null,
    [ending.callLength, liveSession],
  );

  const { sendText, sendWaitingReplies } = useTypedReplies({
    isConnecting: phase === "connecting",
    live: typedLive,
    onSent: input.onSent,
    turnsRef,
    updateTurns,
  });

  const endAtDeadline = useCallback(() => endFromOutside("hardStop"), [endFromOutside]);

  const handleEvent = useLiveCallEvents({
    begin: ending.begin,
    dispatch: ending.dispatch,
    endAtDeadline,
    fail,
    objectives,
    phaseRef,
    report,
    sendWaitingReplies,
    sessionRef,
    setPhase,
    turnsRef,
    updateTurns,
  });

  const [microphoneRefused, setMicrophoneRefused] = useState(false);

  const onMicrophoneBlocked = useCallback(() => {
    setPhase("idle");
    setMicrophoneRefused(true);
  }, [setPhase]);

  const { cancelStart, start } = useConnectCall({
    endAtDeadline,
    endedByServer: connection.endedByServer,
    fail,
    handleEvent,
    hear: input.hear,
    keepAudio: microphone.keep,
    keepSession,
    onMicrophoneBlocked,
    onReserved: report.reserved,
    phaseRef,
    reserve: connection.reserve,
    setPhase,
    stopEnding,
    tappedAudio,
  });

  const finish = useCallFinish({ getConnectionId: connection.getConnectionId, release, turnsRef });

  // Leaving ends the call; a screen kept hidden in an Activity shows it dropped when it's back.
  useEffect(
    () => () => {
      // Cancels a start still waiting; Strict Mode's first setup and cleanup run before any start,
      // so they cancel nothing.
      cancelStart();

      if (phaseRef.current === "connecting" || phaseRef.current === "live") {
        fail(phaseRef.current === "live" ? "dropped" : "connect");
      } else {
        void release();
      }
    },
    [cancelStart, fail, phaseRef, release],
  );

  return {
    /** The learner stopped a call that was still ringing. */
    cancel: () => report.send("learnerEnded"),
    elapsedSeconds: ending.elapsedSeconds,
    endsAtLimit: ending.callLength?.endsAtLimit ?? null,
    error: problem.error,
    finish,
    hangUp: () => endFromOutside("learnerEnded"),
    limit: problem.limit,
    metLabels: objectives.metLabels,
    micBlocked: microphone.blocked,
    /** A call started again without the intro found the microphone blocked: ask the learner. */
    microphoneRefused,
    muted,
    onTyping: input.onTyping,
    phase,
    reconnecting: connection.reconnecting,
    sendText,
    start,
    talkSeconds: ending.callLength?.talkSeconds ?? null,
    toggleMute,
    turn: ending.view,
    turns: savedTurns,
  };
}

export type LiveCall = ReturnType<typeof useLiveCall>;
