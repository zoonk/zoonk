"use client";

import {
  type ConversationTurn,
  type LanguageConversationSetup,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import {
  LIVE_CALL_NO_BACKEND_CUE,
  formatObjectivesProgressCue,
} from "@zoonk/core/language/conversations/live-call-cues";
import {
  type Experimental_RealtimeServerEvent as RealtimeServerEvent,
  type Experimental_RealtimeState as RealtimeState,
} from "ai";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import {
  type LiveCallSession,
  createLiveCallSession,
  openCallAudio,
  sendLiveCallCue,
  watchConnection,
} from "./live-call-session";
import { addTranscriptFragment } from "./live-call-transcript";
import {
  type LiveCallPhase,
  useCallFinish,
  useCallMute,
  useCallPhase,
  useCallTranscript,
  useTypedReplies,
} from "./use-call-controls";
import { useCallClock, useOpeningCue } from "./use-call-cues";
import { useCallMicrophone } from "./use-call-microphone";
import { useObjectiveChecks } from "./use-objective-checks";

/**
 * Why a call couldn't go on: it never connected, it dropped after connecting, it's past the time it
 * could reopen, or the plan's call time is used (`CallLimit` says which).
 */
export type LiveCallError = "connect" | "dropped" | "ended" | "limit";

/** Opening a call: the setup for GPT-Live, or why it can't be made. */
export type ConversationConnection =
  | { setup: LanguageConversationSetup; status: "ready" }
  | { limit: CallLimit; status: "limit" }
  | { status: "ended" | "failed" };

/** What the host does for the call: charge and open it, and mark its goals from the transcript. */
export type LiveCallActions = {
  connect: () => Promise<ConversationConnection>;
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

function toConnectionError(
  status: Exclude<ConversationConnection["status"], "ready">,
): LiveCallError {
  if (status === "failed") {
    return "connect";
  }

  return status;
}

/**
 * The call's goals, checked after each of the character's answers, and GPT-Live told where the
 * learner is so it wraps up once everything is done.
 */
function useCallObjectives({
  checkObjectives,
  conversation,
  getTurns,
  sessionRef,
}: {
  checkObjectives: LiveCallActions["checkObjectives"];
  conversation: LanguageConversationView;
  getTurns: () => ConversationTurn[];
  sessionRef: RefObject<LiveCallSession | null>;
}) {
  const labels = useMemo(() => conversation.objectives.map((item) => item.label), [conversation]);

  const onChange = useCallback(
    (met: string[]) => {
      if (sessionRef.current) {
        sendLiveCallCue({
          channel: "thinking",
          content: formatObjectivesProgressCue({
            met,
            open: labels.filter((label) => !met.includes(label)),
          }),
          session: sessionRef.current,
        });
      }
    },
    [labels, sessionRef],
  );

  return useObjectiveChecks({ checkObjectives, conversation, getTurns, onChange });
}

/**
 * Why the call stopped, while it's stopped, and the plan's call time that ran out when that's why:
 * the microphone closes and the call shows the problem until it starts again.
 */
function useCallProblem({
  phase,
  setPhase,
  stopAudio,
}: {
  phase: LiveCallPhase;
  setPhase: (phase: LiveCallPhase) => void;
  stopAudio: () => void;
}) {
  const [problem, setProblem] = useState<{ error: LiveCallError; limit: CallLimit | null } | null>(
    null,
  );

  const fail = useCallback(
    (error: LiveCallError, limit: CallLimit | null = null) => {
      stopAudio();
      setProblem({ error, limit });
      setPhase("failed");
    },
    [setPhase, stopAudio],
  );

  const shown = phase === "failed" ? problem : null;

  return { error: shown?.error ?? null, fail, limit: shown?.limit ?? null };
}

/**
 * Runs a live call on GPT-Live in the browser: the host charges the call and returns a short-lived
 * token, the browser streams the microphone to GPT-Live and plays its voice, the transcript builds
 * up from both sides, the goals are checked once the character answers each learner turn, and the
 * call wraps up at its length. The microphone is optional and can be muted: typing always works,
 * even while the call connects (those replies go out once it does). A call that doesn't connect
 * within a few seconds fails with a way to try again.
 */
export function useLiveCall({
  actions,
  conversation,
}: {
  actions: LiveCallActions;
  conversation: LanguageConversationView;
}) {
  const [session, setSession] = useState<LiveCallSession | null>(null);
  const { phase, phaseRef, setPhase } = useCallPhase();
  const { getTurns, savedTurns, turnsRef, updateTurns } = useCallTranscript();
  const sessionRef = useRef<LiveCallSession | null>(null);
  const closing = useRef<Promise<unknown> | null>(null);
  const { blocked: micBlocked, keep: keepAudio, stop: stopAudio } = useCallMicrophone();

  const objectives = useCallObjectives({
    checkObjectives: actions.checkObjectives,
    conversation,
    getTurns,
    sessionRef,
  });

  const { metLabels, onCharacterTurn } = objectives;

  const hangUp = useCallback(() => {
    closing.current ??= sessionRef.current?.close().catch(() => null) ?? null;
    setPhase("ended");
  }, [setPhase]);

  const opening = useOpeningCue(conversation.openingLine);

  const { elapsedSeconds, limitNear, limitSeconds, markLearnerActive, startClock } = useCallClock({
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

  const { error, fail, limit } = useCallProblem({ phase, setPhase, stopAudio });

  const liveSession = phase === "live" ? session : null;

  const { sendText, sendWaitingReplies } = useTypedReplies({
    isConnecting: phase === "connecting",
    liveSession,
    onLearnerTurn,
    turnsRef,
    updateTurns,
  });

  const { muted, toggleMute } = useCallMute(liveSession);

  const handleEvent = useCallback(
    (created: LiveCallSession, event: RealtimeServerEvent, setup: LanguageConversationSetup) => {
      if (event.type === "session-started") {
        startClock(setup);
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

      if (event.type === "session-closed" && phaseRef.current === "live") {
        setPhase("ended");
      }
    },
    [
      onCharacterTurn,
      onLearnerTurn,
      opening,
      phaseRef,
      sendWaitingReplies,
      setPhase,
      startClock,
      turnsRef,
      updateTurns,
    ],
  );

  const start = useCallback(async () => {
    setPhase("connecting");

    // The microphone prompt and charging the call don't wait on each other: a failed call closes
    // the microphone, and a blocked microphone still leaves typing.
    const [audio, connection] = await Promise.all([
      openCallAudio(),
      actions.connect().catch(() => ({ status: "failed" as const })),
    ]);

    if (!keepAudio(audio)) {
      return;
    }

    if (connection.status !== "ready") {
      fail(toConnectionError(connection.status), "limit" in connection ? connection.limit : null);
      return;
    }

    const created: LiveCallSession = createLiveCallSession({
      instructions: conversation.instructions ?? "",
      onEvent: (event) => handleEvent(created, event, connection.setup),
      setup: connection.setup,
    });

    watchConnection({
      isOpen: () => phaseRef.current === "connecting" || phaseRef.current === "live",
      onLost: () => fail(phaseRef.current === "live" ? "dropped" : "connect"),
      session: created,
    });

    sessionRef.current = created;
    setSession(created);
    void created.connect({ stream: audio.stream });
  }, [actions, conversation.instructions, fail, handleEvent, keepAudio, phaseRef, setPhase]);

  const finish = useCallFinish({ closing, session, stopAudio, turnsRef });

  useEffect(() => () => session?.dispose(), [session]);

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
    sendText,
    start,
    toggleMute,
    turns: savedTurns,
  };
}

export type LiveCall = ReturnType<typeof useLiveCall>;
