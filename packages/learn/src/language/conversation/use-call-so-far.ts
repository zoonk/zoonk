"use client";

import { useCallback, useRef, useState } from "react";
import { getCallLength } from "./live-call-clock";
import { type CallSoFar, carryCallSoFar, startCallOver } from "./live-call-so-far";
import { toConversationTurns } from "./live-call-transcript";
import { type LiveCallSetup } from "./use-call-connection";
import { useCallTranscript } from "./use-call-controls";

const SECONDS_PER_MINUTE = 60;

/**
 * The call so far, which this connection continues, or drops when the server says it opens a new
 * call: `prepare` decides on the server's answer.
 */
export function useCallSoFar({ earlier, minutes }: { earlier: CallSoFar; minutes: number }) {
  const before = useRef(earlier);
  const examCuesSent = useRef(earlier.examCuesSent);
  const [helpedBefore, setHelpedBefore] = useState(earlier.usedHelp);
  const [helped, setHelped] = useState(false);
  const usedHelp = helpedBefore || helped;
  const transcript = useCallTranscript(earlier.turns);
  const { turnsRef, updateTurns } = transcript;

  const getConnectionTurns = useCallback(
    () => turnsRef.current.slice(before.current.turns.length),
    [turnsRef],
  );

  const prepare = useCallback(
    (setup: LiveCallSetup, answeredAt: number) => {
      if (!setup.continuesCall) {
        updateTurns(getConnectionTurns());
        before.current = startCallOver(before.current);
        examCuesSent.current = 0;
        setHelpedBefore(false);
      }

      return {
        length: getCallLength({ answeredAt, callSeconds: minutes * SECONDS_PER_MINUTE, setup }),
        turns: toConversationTurns(before.current.turns),
      };
    },
    [getConnectionTurns, minutes, updateTurns],
  );

  const carry = useCallback(
    (metLabels: string[]) =>
      carryCallSoFar({
        before: before.current,
        examCuesSent: examCuesSent.current,
        metLabels,
        turns: turnsRef.current,
        usedHelp,
      }),
    [turnsRef, usedHelp],
  );

  const markHelpUsed = useCallback(() => setHelped(true), []);

  return {
    ...transcript,
    carry,
    examCuesSent,
    getConnectionTurns,
    markHelpUsed,
    prepare,
    usedHelp,
  };
}
