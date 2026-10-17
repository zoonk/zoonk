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
import { getCallEndsAt } from "./call-deadline";
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

/**
 * Why a call couldn't go on: it never connected, it dropped after connecting, it's past the time it
 * could reopen, the plan's call time is used (`CallLimit` says which), it's a call the learner's
 * plan leaves to Plus (Plus lapsed since it was opened), calls are paused, or another call of the
 * learner's is open (in another tab or on another device).
 */
export type LiveCallError =
  | "callInProgress"
  | "callsPaused"
  | "connect"
  | "dropped"
  | "ended"
  | "limit"
  | "plusRequired";

/**
 * What the host does for the call: reserve it, close it on the server, and mark its goals from the
 * transcript.
 */
export type LiveCallActions = CallConnectionActions & {
  /** Every goal met so far, from what was said; null when the check didn't run. */
  checkObjectives: (turns: ConversationTurn[]) => Promise<string[] | null>;
};

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
 * What a call needs before it's reserved, since the server's deadline starts when it is: the
 * microphone first (`tapped`: the one the Start tap opened), so the permission prompt never takes
 * time from the call (a blocked one still sends silence), and the realtime client loaded
 * meanwhile, usually already in from the learner reaching for Start. Null when the start was
 * cancelled meanwhile; `live` is null when the client didn't load.
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
  // A last connection still closing after the second try is a call that didn't connect yet.
  if (status === "failed" || status === "previousConnectionClosing") {
    return "connect";
  }

  return status;
}

/**
 * Why the call stopped, while it's stopped, and the plan's call time that ran out when that's why:
 * the call is closed on the server and the call shows the problem until it starts again.
 */
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
 * Ending the call. `hangUp` silences it at once on this side (the microphone, what's sent and what
 * plays) and ends the call. `release` silences it and has the server close it: true once the
 * server confirmed, and only then does the browser drop its peer, so the server collects the
 * session's end itself.
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

/**
 * Runs a live call on GPT-Live in the browser. The microphone opens first (or silence, so typing
 * still works), then the host reserves the call on the server, which fixes its absolute deadline
 * and creates the session; the browser sends its audio and plays the character's voice over
 * WebRTC. The transcript builds up from both sides, the goals are checked once the character
 * answers each learner turn, and the call wraps up before its deadline. Ending it, from here or by
 * the server, silences it at once; the server then closes it and confirms before the peer goes and
 * before anything is saved. Typing always works, even while the call connects (those replies go
 * out once it does). A call that doesn't connect within a few seconds fails with a way to try
 * again.
 */
export function useLiveCall({
  actions,
  conversation,
  tappedAudio,
}: {
  actions: LiveCallActions;
  conversation: LanguageConversationView;
  /** The microphone the tap that created the call opened, for its first start. */
  tappedAudio?: TappedCallAudio;
}) {
  const [session, setSession] = useState<LiveCallSession | null>(null);
  const { phase, phaseRef, setPhase } = useCallPhase();
  const { getTurns, savedTurns, turnsRef, updateTurns } = useCallTranscript();
  const sessionRef = useRef<LiveCallSession | null>(null);
  const attempt = useRef(0);
  const { blocked: micBlocked, keep: keepAudio, stop: stopAudio } = useCallMicrophone();
  const connection = useCallConnection(actions);
  const { end: endConnection, getConnectionId, reserve } = connection;

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

  // Every word the learner says or types keeps the call from ending on its silence timeout.
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
      // Each start is its own attempt, and leaving the screen cancels it for good: a microphone or
      // a reservation that arrives later is let go, even if the screen is shown again meanwhile.
      const mine = attempt.current + 1;
      attempt.current = mine;
      const isCurrent = () => attempt.current === mine;

      setPhase("connecting");

      const opened = await openCall({ isCurrent, keepAudio, tapped: tappedAudio?.take() ?? null });

      if (!opened) {
        return;
      }

      // A realtime client that didn't load can't connect.
      if (!opened.live) {
        fail("connect");
        return;
      }

      const { audio, live } = opened;
      const answer = await reserve({ isCurrent, takeover });

      // The start was cancelled meanwhile; a reservation it got was ended, so it never connects.
      if (!answer || !isCurrent()) {
        return;
      }

      if (answer.status !== "ready") {
        fail(toConnectionError(answer.status), "limit" in answer ? answer.limit : null);
        return;
      }

      const { createLiveCallSession, watchConnection } = live;
      const { setup } = answer;

      const length: CallLength = {
        endsAt: getCallEndsAt({
          deadlineAt: setup.deadlineAt,
          now: Date.now(),
          seconds: setup.seconds,
        }),
        endsAtLimit: setup.endsAtLimit,
      };

      const created: LiveCallSession = createLiveCallSession({
        onEvent: (event) => handleEvent(created, event, length),
        sessionUrl: setup.sessionUrl,
      });

      watchConnection({
        isOpen: () => phaseRef.current === "connecting" || phaseRef.current === "live",
        onLost: () => fail(phaseRef.current === "live" ? "dropped" : "connect"),
        session: created,
      });

      sessionRef.current = created;
      setSession(created);
      // The session reports its own failures through its state, which `watchConnection` follows;
      // only a second connect on one session rejects, and this run connects each session once.
      void created.connect({ stream: audio.stream }).catch(() => null);
    },
    [fail, handleEvent, keepAudio, phaseRef, reserve, setPhase, tappedAudio],
  );

  const finish = useCallFinish({ getConnectionId, release, sessionRef, turnsRef });

  // Leaving the screen ends the call too. A screen kept hidden in an Activity shows the call as
  // dropped when it's back, with its transcript, since the call can't go on from there.
  useEffect(
    () => () => {
      // Cancels a start still waiting on the microphone or its reservation. React's first setup
      // and cleanup in Strict Mode run before any start, so they cancel nothing.
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
