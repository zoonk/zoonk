"use client";

import {
  type ConversationTurn,
  type LanguageConversationSetup,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import {
  LIVE_CALL_NO_BACKEND_CUE,
  formatObjectivesProgressCue,
  formatTypedReplyCue,
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
import {
  type LiveCallSession,
  createLiveCallSession,
  openCallAudio,
  sendLiveCallCue,
} from "./live-call-session";
import {
  type TranscriptTurn,
  addTranscriptFragment,
  addTypedReply,
  getSpokenSeconds,
  toConversationTurns,
} from "./live-call-transcript";
import { useCallClock, useOpeningCue } from "./use-call-cues";
import { useCallMicrophone } from "./use-call-microphone";
import { useObjectiveChecks } from "./use-objective-checks";

const SECONDS_PER_MINUTE = 60;

export type LiveCallPhase = "connecting" | "ended" | "failed" | "idle" | "live";

/** Why a call couldn't go on: the day's calls used, or anything else. */
export type LiveCallError = "limit" | "other";

/** Opening a call: the setup for GPT-Live, or why it can't be made. */
export type ConversationConnection =
  | { setup: LanguageConversationSetup; status: "ready" }
  | { status: "failed" | "limit" };

/** What the host does for the call: charge and open it, and mark its goals from the transcript. */
export type LiveCallActions = {
  connect: () => Promise<ConversationConnection>;
  /** Every goal met so far, from what was said; null when the check didn't run. */
  checkObjectives: (turns: ConversationTurn[]) => Promise<string[] | null>;
};

/** What a finished call saves: what was said, how long the learner spoke, and the billed session. */
export type LiveCallSummary = {
  spokenSeconds: number;
  turns: ConversationTurn[];
  voiceSeconds?: number;
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
 * Runs a live call on GPT-Live in the browser: the host charges the call and returns a short-lived
 * token, the browser streams the microphone to GPT-Live and plays its voice, the transcript builds
 * up from both sides, the goals are checked once the character answers each learner turn, and the
 * call wraps up at its length. The microphone is optional: typing always works.
 */
export function useLiveCall({
  actions,
  conversation,
}: {
  actions: LiveCallActions;
  conversation: LanguageConversationView;
}) {
  const [session, setSession] = useState<LiveCallSession | null>(null);
  const [phase, setPhase] = useState<LiveCallPhase>("idle");
  const [error, setError] = useState<LiveCallError | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const turnsRef = useRef<TranscriptTurn[]>([]);
  const sessionRef = useRef<LiveCallSession | null>(null);
  const closing = useRef<Promise<unknown> | null>(null);
  const getTurns = useCallback(() => toConversationTurns(turnsRef.current), []);
  const { blocked: micBlocked, keep: keepAudio, stop: stopAudio } = useCallMicrophone();

  const { metLabels, onCharacterTurn, onLearnerTurn } = useCallObjectives({
    checkObjectives: actions.checkObjectives,
    conversation,
    getTurns,
    sessionRef,
  });

  const hangUp = useCallback(() => {
    closing.current ??= sessionRef.current?.close().catch(() => null) ?? null;
    setPhase("ended");
  }, []);

  const limitSeconds = conversation.minutes * SECONDS_PER_MINUTE;

  const opening = useOpeningCue(conversation.openingLine);

  const { elapsedSeconds, startClock } = useCallClock({
    hangUp,
    limitSeconds,
    session: phase === "live" ? session : null,
  });

  const state = useSyncExternalStore(
    session?.subscribe ?? noSubscription,
    session?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  );

  const savedTurns = useMemo(() => toConversationTurns(turns), [turns]);

  const updateTurns = useCallback((next: TranscriptTurn[]) => {
    turnsRef.current = next;
    setTurns(next);
  }, []);

  const fail = useCallback(
    (cause: LiveCallError) => {
      stopAudio();
      setError(cause);
      setPhase("failed");
    },
    [stopAudio],
  );

  const handleEvent = useCallback(
    (created: LiveCallSession, event: RealtimeServerEvent) => {
      if (event.type === "session-started") {
        startClock();
        setPhase("live");
        opening.open(created);
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
        setPhase((current) => (current === "live" ? "ended" : current));
      }
    },
    [onCharacterTurn, onLearnerTurn, opening, startClock, updateTurns],
  );

  const start = useCallback(async () => {
    setError(null);
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
      fail(connection.status === "limit" ? "limit" : "other");
      return;
    }

    const created: LiveCallSession = createLiveCallSession({
      instructions: conversation.instructions ?? "",
      // A dropped connection ends the session; a cue it rejected doesn't.
      onError: () => {
        if (created.getSnapshot().status === "error") {
          fail("other");
        }
      },
      onEvent: (event) => handleEvent(created, event),
      setup: connection.setup,
    });

    sessionRef.current = created;
    setSession(created);
    void created.connect({ stream: audio.stream });
  }, [actions, conversation.instructions, fail, handleEvent, keepAudio]);

  /** Waits for GPT-Live to confirm the call closed, then returns what the call saves. */
  const finish = useCallback(async (): Promise<LiveCallSummary> => {
    await closing.current;
    stopAudio();
    const voiceSeconds = session?.getSnapshot().session?.usage?.seconds;

    return {
      spokenSeconds: getSpokenSeconds(turnsRef.current),
      turns: toConversationTurns(turnsRef.current),
      ...(voiceSeconds === undefined ? {} : { voiceSeconds: Math.round(voiceSeconds) }),
    };
  }, [session, stopAudio]);

  const sendText = useCallback(
    (text: string) => {
      if (!session || phase !== "live") {
        return;
      }

      updateTurns(addTypedReply(turnsRef.current, text));
      onLearnerTurn();
      sendLiveCallCue({ content: formatTypedReplyCue(text), session });
    },
    [onLearnerTurn, phase, session, updateTurns],
  );

  useEffect(() => () => session?.dispose(), [session]);

  return {
    elapsedSeconds,
    error,
    finish,
    hangUp,
    isCapturing: state.isCapturing,
    isPlaying: state.isPlaying,
    limitSeconds,
    metLabels,
    micBlocked,
    phase,
    sendText,
    start,
    turns: savedTurns,
  };
}

export type LiveCall = ReturnType<typeof useLiveCall>;
