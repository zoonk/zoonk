"use client";

import {
  type ConversationTurn,
  type LanguageConversationObjectiveCheck,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { type RefObject, useCallback, useState } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { type CallLength } from "./live-call-clock";
import { type CallEndingEvent } from "./live-call-ending";
import {
  type LiveCallError,
  useCallProblem,
  useCallRelease,
  useCallSession,
  useEndCallOnLeave,
} from "./live-call-lifecycle";
import { type ReplyGapEvent } from "./live-call-report";
import { type LiveCallSession } from "./live-call-session";
import { type CallSoFar } from "./live-call-so-far";
import { type SpeechSample } from "./speech-activity";
import { type CallConnectionActions, useCallConnection } from "./use-call-connection";
import { useCallFinish, useCallMute, useCallPhase, useTypedReplies } from "./use-call-controls";
import { useCallEnding } from "./use-call-ending";
import { useCallEvents } from "./use-call-events";
import {
  type MicrophoneProblem,
  type TappedCallAudio,
  useCallMicrophone,
} from "./use-call-microphone";
import { type CallEndReason, type CallReport, useCallReport } from "./use-call-report";
import { useCallSoFar } from "./use-call-so-far";
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

/**
 * `earlier` is the call so far, which this connection continues or, when the server says it opens
 * a new call, drops.
 */
export function useLiveCall({
  actions,
  conversation,
  earlier,
  tappedAudio,
}: {
  actions: LiveCallActions;
  conversation: LanguageConversationView;
  earlier: CallSoFar;
  tappedAudio?: TappedCallAudio;
}) {
  const connection = useCallConnection(actions);
  const soFar = useCallSoFar({ connection, earlier, minutes: conversation.minutes });
  const { carry, getConnectionTurns, getTurns, turnsRef, updateTurns } = soFar;
  const { keepSession, session, sessionRef } = useCallSession();
  const { phase, phaseRef, setPhase } = useCallPhase();
  const microphone = useCallMicrophone();
  const report = useCallReport({ getConnectionTurns, kind: conversation.kind });

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
    examCuesSent: soFar.examCuesSent,
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
    metBefore: earlier.metLabels,
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

  const { sendText, sendWaitingReplies } = useTypedReplies({
    isConnecting: phase === "connecting",
    onSent: input.onSent,
    script: ending.callLength?.script ?? null,
    session: liveSession,
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

  const [microphoneProblem, setMicrophoneProblem] = useState<MicrophoneProblem | null>(null);

  const { cancelStart, dropStart, start } = useConnectCall({
    endAtDeadline,
    endedByServer: connection.endedByServer,
    fail,
    handleEvent,
    hear: input.hear,
    keepAudio: microphone.keep,
    keepSession,
    onMicrophoneProblem: setMicrophoneProblem,
    onReserved: report.reserved,
    phaseRef,
    prepare: soFar.prepare,
    reserve: connection.reserve,
    setPhase,
    stopEnding,
    tappedAudio,
  });

  const { metLabels } = objectives;
  const live = ending.callLength !== null;

  const getCallSoFar = useCallback(() => carry({ live, metLabels }), [carry, live, metLabels]);

  const finish = useCallFinish({ getCallSoFar, release, settle: connection.settle });

  useEndCallOnLeave({ cancelStart, fail, phaseRef, release });

  return {
    /** The learner stopped a call that was still ringing. */
    cancel: () => report.send("learnerEnded"),
    continuing: soFar.continuing,
    dropStart,
    elapsedSeconds: ending.elapsedSeconds,
    error: problem.error,
    finish,
    getCallSoFar,
    hangUp: () => endFromOutside("learnerEnded"),
    limit: problem.limit,
    markHelpUsed: soFar.markHelpUsed,
    metLabels,
    micBlocked: microphone.blocked,
    /** A call started again without the intro couldn't use the microphone: ask the learner. */
    microphoneProblem,
    muted,
    onTyping: input.onTyping,
    phase,
    reconnecting: connection.reconnecting,
    sendText,
    settle: connection.settle,
    start,
    toggleMute,
    turn: ending.view,
    turns: soFar.savedTurns,
    usedHelp: soFar.usedHelp,
  };
}

export type LiveCall = ReturnType<typeof useLiveCall>;
