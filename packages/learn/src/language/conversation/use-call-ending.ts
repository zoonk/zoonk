"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { type CallLength, type TimedCue, takeDueExamCue } from "./live-call-clock";
import { sendLiveCallCue } from "./live-call-commands";
import {
  type CallEndingCommand,
  type CallEndingState,
  type CallEndingView,
  type CallHangUpReason,
  getCallEndingView,
  startCallEnding,
  stepCallEnding,
} from "./live-call-ending";
import { type CallEndingEvent } from "./live-call-ending-event";
import { type LiveCallCue } from "./live-call-script";
import { type LiveCallSession } from "./live-call-session";
import { type ObjectiveCheckResult } from "./use-objective-checks";

const TICK_MS = 250;
const MS_PER_SECOND = 1000;

const NO_CUES: readonly TimedCue[] = [];

type RunningCall = { length: CallLength; session: LiveCallSession; state: CallEndingState };

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
  examCuesSent,
  onCue,
  onHangUp,
}: {
  examCues?: readonly TimedCue[];
  examCuesSent: RefObject<number>;
  /** Any cue went out, which the character's next words may answer instead of the learner. */
  onCue: () => void;
  onHangUp: (reason: CallHangUpReason) => void;
}) {
  const running = useRef<RunningCall | null>(null);
  const progress = useRef<LiveCallCue | null>(null);
  const [view, setView] = useState<CallEndingView | null>(null);
  const [clockFrom, setClockFrom] = useState<number | null>(null);
  const [callLength, setCallLength] = useState<CallLength | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const run = useCallback(
    (call: RunningCall, commands: CallEndingCommand[]) => {
      const { cues } = call.length.script;

      for (const command of commands) {
        if (command.type === "cue") {
          const eventId = "id" in command ? command.id : undefined;
          sendLiveCallCue({ cue: cues[command.cue], eventId, session: call.session });
        }

        if (command.type === "goodbye") {
          const { text } = cues[command.cue];
          const channel = command.whileLearnerSpeaks ? "thinking" : cues[command.cue].channel;
          sendLiveCallCue({ cue: { channel, text }, eventId: command.id, session: call.session });
        }

        if (command.type === "progress" && progress.current) {
          sendLiveCallCue({ cue: progress.current, session: call.session });
          progress.current = null;
        }

        if (command.type === "hangUp") {
          onHangUp(command.reason);
        } else {
          onCue();
        }
      }
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

      const call: RunningCall = { length, session, state: start.state };
      const from = length.clockFrom ?? at;
      running.current = call;
      setCallLength(length);
      setClockFrom(from);
      setElapsedSeconds(Math.floor((at - from) / MS_PER_SECOND));
      setView(getCallEndingView(start.state, at));
      run(call, start.commands);
    },
    [run],
  );

  const checked = useCallback(
    (result: ObjectiveCheckResult) => {
      progress.current = result.progress ?? progress.current;

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
    if (clockFrom === null) {
      return;
    }

    const timer = setInterval(() => {
      const call = running.current;

      if (!call || call.state.ended) {
        clearInterval(timer);
        return;
      }

      const at = Date.now();
      const elapsed = Math.floor((at - clockFrom) / MS_PER_SECOND);
      setElapsedSeconds(elapsed);
      dispatch({ at, type: "tick" });

      const sent = examCuesSent.current;
      const due = takeDueExamCue({ cues: examCues, elapsedSeconds: elapsed, sent });
      const cue = { channel: "instructions", text: due?.cue.say ?? "" } as const;

      // Cues wait for the character's first words, so a continued call's overdue cue follows its
      // resume line. One the session refused, as its connection was lost, stays due.
      const open = call.state.characterAt !== null && !call.state.reason;

      if (due && open && sendLiveCallCue({ cue, session: call.session })) {
        examCuesSent.current = due.sent;
        onCue();
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [clockFrom, dispatch, examCues, examCuesSent, onCue]);

  // A call ended or failed from outside (End, a drop, the server's hangup) stops its clock, so a
  // late tick or check can't end it once more, or save a call the learner may still call again.
  const stop = useCallback(() => {
    running.current = null;
    setClockFrom(null);
  }, []);

  return { begin, callLength, checked, dispatch, elapsedSeconds, stop, view };
}
