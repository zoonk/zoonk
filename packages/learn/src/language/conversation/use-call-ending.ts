"use client";

import { type LanguageConversationSetup } from "@zoonk/core/language/conversations/contract";
import { useCallback, useEffect, useRef, useState } from "react";
import { sendLiveCallCue } from "./live-call-commands";
import {
  type CallEndingCommand,
  type CallEndingEvent,
  type CallEndingState,
  type CallEndingView,
  type CallHangUpReason,
  getCallEndingView,
  startCallEnding,
  stepCallEnding,
} from "./live-call-ending";
import { type LiveCallCue, type LiveCallScript } from "./live-call-script";
import { type LiveCallSession } from "./live-call-session";
import { type ObjectiveCheckResult } from "./use-objective-checks";

const TICK_MS = 250;
const MS_PER_SECOND = 1000;

/**
 * On this device's clock, from when the server's answer arrived: the time it said was left, so a
 * device whose clock is off still ends on time.
 */
export type CallLength = {
  hardStopAt: number;
  script: LiveCallScript;
  talkEndsAt: number;
  talkSeconds: number;
} & Pick<LanguageConversationSetup, "endsAtLimit">;

type TimedCue = { atSeconds: number; say: string };

const NO_CUES: readonly TimedCue[] = [];

type RunningCall = {
  length: CallLength;
  session: LiveCallSession;
  startedAt: number;
  state: CallEndingState;
};

function isSameView(first: CallEndingView | null, second: CallEndingView) {
  return (
    first !== null &&
    Object.entries(second).every(([key, value]) => Reflect.get(first, key) === value)
  );
}

/**
 * Runs the call's ending (`live-call-ending.ts`) on the clock and the call's events, and sends the
 * cues it asks for. An exam's own timed cues stop once the ending started.
 */
export function useCallEnding({
  examCues = NO_CUES,
  onCue,
  onHangUp,
}: {
  examCues?: readonly TimedCue[];
  /** Any cue went out, which the character's next words may answer instead of the learner. */
  onCue: () => void;
  onHangUp: (reason: CallHangUpReason) => void;
}) {
  const running = useRef<RunningCall | null>(null);
  const progress = useRef<LiveCallCue | null>(null);
  const examCuesSent = useRef(0);
  const [view, setView] = useState<CallEndingView | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [callLength, setCallLength] = useState<CallLength | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const run = useCallback(
    (call: RunningCall, commands: CallEndingCommand[]) => {
      const { cues } = call.length.script;

      for (const command of commands) {
        if (command.type === "cue" || command.type === "goodbye") {
          const eventId = "id" in command ? command.id : undefined;
          sendLiveCallCue({ cue: cues[command.cue], eventId, session: call.session });
        }

        if (command.type === "progress" && progress.current) {
          sendLiveCallCue({ cue: progress.current, session: call.session });
        }

        if (command.type === "hangUp") {
          onHangUp(command.reason);
        } else {
          onCue();
        }
      }

      progress.current = null;
    },
    [onCue, onHangUp],
  );

  const dispatch = useCallback(
    (event: CallEndingEvent) => {
      const call = running.current;

      if (!call) {
        return;
      }

      const step = stepCallEnding(call.state, event);
      call.state = step.state;
      const next = getCallEndingView(step.state, event.at);
      setView((current) => (isSameView(current, next) ? current : next));
      run(call, step.commands);
    },
    [run],
  );

  const begin = useCallback(
    (session: LiveCallSession, length: CallLength) => {
      const at = Date.now();

      const start = startCallEnding({
        at,
        hardStopAt: length.hardStopAt,
        talkEndsAt: length.talkEndsAt,
        timing: length.script.timing,
      });

      const call: RunningCall = { length, session, startedAt: at, state: start.state };
      running.current = call;
      setCallLength(length);
      setStartedAt(at);
      setView(getCallEndingView(start.state, at));
      run(call, start.commands);
    },
    [run],
  );

  const checked = useCallback(
    (result: ObjectiveCheckResult) => {
      progress.current = result.progress;

      dispatch({
        allMet: result.allMet,
        at: Date.now(),
        goodbye: result.goodbye,
        progress: result.progress !== null,
        snapshotAt: result.snapshotAt,
        type: "checked",
      });
    },
    [dispatch],
  );

  useEffect(() => {
    if (startedAt === null) {
      return;
    }

    const timer = setInterval(() => {
      const call = running.current;

      if (!call || call.state.ended) {
        clearInterval(timer);
        return;
      }

      const at = Date.now();
      const elapsed = Math.floor((at - startedAt) / MS_PER_SECOND);
      const cue = examCues[examCuesSent.current];
      setElapsedSeconds(elapsed);
      dispatch({ at, type: "tick" });

      if (cue && !call.state.reason && elapsed >= cue.atSeconds) {
        examCuesSent.current += 1;
        sendLiveCallCue({ cue: { channel: "instructions", text: cue.say }, session: call.session });
        onCue();
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [dispatch, examCues, onCue, startedAt]);

  // A call ended or failed from outside (End, a drop, the server's hangup) stops its clock, so a
  // late tick or check can't end it once more, or save a call the learner may still call again.
  const stop = useCallback(() => {
    running.current = null;
    setStartedAt(null);
  }, []);

  return { begin, callLength, checked, dispatch, elapsedSeconds, stop, view };
}
