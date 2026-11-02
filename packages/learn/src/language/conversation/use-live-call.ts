"use client";

import {
  type ConversationTurn,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { type Experimental_RealtimeState as RealtimeState } from "ai";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { type LiveCallSession } from "./live-call-session";
import { loadLiveCallSession } from "./load-live-call-session";
import {
  type CallConnectionActions,
  type ConversationConnection,
  useCallConnection,
} from "./use-call-connection";
import {
  type LiveCallPhase,
  useCallFinish,
  useCallMute,
  useCallPhase,
  useCallTranscript,
  useTypedReplies,
} from "./use-call-controls";
import { type CallLength, useCallClock, useOpeningCue } from "./use-call-cues";
import { useCallEvents } from "./use-call-events";
import {
  type CallAudio,
  type TappedCallAudio,
  openCallAudio,
  useCallMicrophone,
} from "./use-call-microphone";
import { useCallObjectives } from "./use-objective-checks";

export type LiveCallError =
  | "callInProgress"
  | "callsPaused"
  | "connect"
  | "dropped"
  | "ended"
  | "limit"
  | "plusRequired";

export type LiveCallActions = CallConnectionActions & {
  /** Every goal met so far; null when the check didn't run. */
  checkObjectives: (turns: ConversationTurn[]) => Promise<string[] | null>;
};

const MS_PER_SECOND = 1000;

const EMPTY_STATE: RealtimeState = {
  events: [],
  isCapturing: false,
  isPlaying: false,
  messages: [],
  status: "disconnected",
};

const noSubscription = () => () => {
  // Nothing to stop listening to before the call starts.
};

const emptySnapshot = () => EMPTY_STATE;

/**
 * The microphone opens before the call is reserved, since the server's deadline starts then and a
 * permission prompt would take its time. Null when the start was cancelled meanwhile.
 */
async function openCall({
  isCurrent,
  keepAudio,
  tapped,
}: {
  isCurrent: () => boolean;
  keepAudio: (audio: CallAudio) => boolean;
  tapped: Promise<CallAudio> | null;
}) {
  const live = loadLiveCallSession();
  const audio = await (tapped ?? openCallAudio());

  if (!isCurrent()) {
    audio.stop();
    return null;
  }

  if (!keepAudio(audio)) {
    return null;
  }

  const loaded = await live;
  return isCurrent() ? { audio, live: loaded } : null;
}

function toConnectionError(
  status: Exclude<ConversationConnection["status"], "ready">,
): LiveCallError {
  if (status === "failed" || status === "previousConnectionClosing") {
    return "connect";
  }

  return status;
}

function useCallProblem({
  phase,
  release,
  setPhase,
}: {
  phase: LiveCallPhase;
  release: () => Promise<boolean>;
  setPhase: (phase: LiveCallPhase) => void;
}) {
  const [problem, setProblem] = useState<{ error: LiveCallError; limit: CallLimit | null } | null>(
    null,
  );

  const fail = useCallback(
    (error: LiveCallError, limit: CallLimit | null = null) => {
      void release();
      setProblem({ error, limit });
      setPhase("failed");
    },
    [release, setPhase],
  );

  const shown = phase === "failed" ? problem : null;

  return { error: shown?.error ?? null, fail, limit: shown?.limit ?? null };
}

/**
 * `release` resolves true once OpenAI confirmed the session is over; only then does the browser
 * drop its peer.
 */
function useCallEnding({
  endConnection,
  sessionRef,
  setPhase,
  stopAudio,
}: {
  endConnection: () => Promise<boolean>;
  sessionRef: RefObject<LiveCallSession | null>;
  setPhase: (phase: LiveCallPhase) => void;
  stopAudio: () => void;
}) {
  const silence = useCallback(() => {
    stopAudio();
    sessionRef.current?.silence();
  }, [sessionRef, stopAudio]);

  const release = useCallback(async () => {
    silence();
    const closed = await endConnection();

    if (closed) {
      sessionRef.current?.dispose();
    }

    return closed;
  }, [endConnection, sessionRef, silence]);

  const hangUp = useCallback(() => {
    silence();
    setPhase("ended");
  }, [setPhase, silence]);

  return { hangUp, release };
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
  const [session, setSession] = useState<LiveCallSession | null>(null);
  const { phase, phaseRef, setPhase } = useCallPhase();
  const { getTurns, savedTurns, turnsRef, updateTurns } = useCallTranscript();
  const sessionRef = useRef<LiveCallSession | null>(null);
  const attempt = useRef(0);
  const { blocked: micBlocked, keep: keepAudio, stop: stopAudio } = useCallMicrophone();
  const connection = useCallConnection(actions);
  const { end: endConnection, endedByServer, getConnectionId, reserve } = connection;

  const objectives = useCallObjectives({
    checkObjectives: actions.checkObjectives,
    conversation,
    getTurns,
    sessionRef,
  });

  const { metLabels, onCharacterTurn } = objectives;

  const { hangUp, release } = useCallEnding({ endConnection, sessionRef, setPhase, stopAudio });

  const opening = useOpeningCue(conversation.openingLine);

  const { elapsedSeconds, limitNear, limitSeconds, markLearnerActive, startClock } = useCallClock({
    cues: conversation.examTask?.cues,
    hangUp,
    minutes: conversation.minutes,
    session: phase === "live" ? session : null,
  });

  const objectivesLearnerTurn = objectives.onLearnerTurn;

  const onLearnerTurn = useCallback(() => {
    markLearnerActive();
    objectivesLearnerTurn();
  }, [markLearnerActive, objectivesLearnerTurn]);

  const state = useSyncExternalStore(
    session?.subscribe ?? noSubscription,
    session?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  );

  const { error, fail, limit } = useCallProblem({ phase, release, setPhase });

  const liveSession = phase === "live" ? session : null;

  const { sendText, sendWaitingReplies } = useTypedReplies({
    isConnecting: phase === "connecting",
    liveSession,
    onLearnerTurn,
    turnsRef,
    updateTurns,
  });

  const { muted, toggleMute } = useCallMute(liveSession);

  const failToConnect = useCallback(() => fail("connect"), [fail]);

  const handleEvent = useCallEvents({
    hangUp,
    onCharacterTurn,
    onClosedEarly: failToConnect,
    onLearnerTurn,
    opening,
    phaseRef,
    sendWaitingReplies,
    sessionRef,
    setPhase,
    startClock,
    turnsRef,
    updateTurns,
  });

  const start = useCallback(
    async (takeover = false) => {
      const mine = attempt.current + 1;
      attempt.current = mine;
      const isCurrent = () => attempt.current === mine;

      setPhase("connecting");

      const opened = await openCall({ isCurrent, keepAudio, tapped: tappedAudio?.take() ?? null });

      if (!opened) {
        return;
      }

      if (!opened.live) {
        fail("connect");
        return;
      }

      const { audio, live } = opened;
      const answer = await reserve({ isCurrent, takeover });

      if (!answer || !isCurrent()) {
        return;
      }

      if (answer.status !== "ready") {
        fail(toConnectionError(answer.status), "limit" in answer ? answer.limit : null);
        return;
      }

      const { createLiveCallSession, watchConnection } = live;
      const { setup } = answer;

      // The time the server said was left, from now: the device's clock can be off.
      const length: CallLength = {
        endsAt: Date.now() + setup.seconds * MS_PER_SECOND,
        endsAtLimit: setup.endsAtLimit,
      };

      const created: LiveCallSession = createLiveCallSession({
        onEvent: (event) => handleEvent(created, event, length),
        sessionUrl: setup.sessionUrl,
      });

      watchConnection({
        endedByServer,
        isOpen: () => phaseRef.current === "connecting" || phaseRef.current === "live",
        onEnded: hangUp,
        onLost: () => fail(phaseRef.current === "live" ? "dropped" : "connect"),
        session: created,
      });

      sessionRef.current = created;
      setSession(created);
      // Failures arrive via the session's state (`watchConnection`); only a second connect rejects.
      void created.connect({ stream: audio.stream }).catch(() => null);
    },
    [endedByServer, fail, handleEvent, hangUp, keepAudio, phaseRef, reserve, setPhase, tappedAudio],
  );

  const finish = useCallFinish({ getConnectionId, release, turnsRef });

  // Leaving ends the call; a screen kept hidden in an Activity shows it dropped when it's back.
  useEffect(
    () => () => {
      // Cancels a start still waiting; Strict Mode's first setup and cleanup run before any start,
      // so they cancel nothing.
      attempt.current += 1;

      if (phaseRef.current === "connecting" || phaseRef.current === "live") {
        fail(phaseRef.current === "live" ? "dropped" : "connect");
      } else {
        void release();
      }
    },
    [fail, phaseRef, release],
  );

  return {
    elapsedSeconds,
    error,
    finish,
    hangUp,
    isCapturing: state.isCapturing,
    isPlaying: state.isPlaying,
    limit,
    limitNear,
    limitSeconds,
    metLabels,
    micBlocked,
    muted,
    phase,
    reconnecting: connection.reconnecting,
    sendText,
    start,
    toggleMute,
    turns: savedTurns,
  };
}

export type LiveCall = ReturnType<typeof useLiveCall>;
