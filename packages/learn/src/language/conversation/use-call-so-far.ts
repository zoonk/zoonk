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
 * call: `prepare` decides on the server's answer. `continuing`: there's a dropped call to save.
 */
export function useCallSoFar({
  connection: { getConnectionId },
  earlier,
  minutes,
}: {
  connection: { getConnectionId: () => string | null };
  earlier: CallSoFar;
  minutes: number;
}) {
  const before = useRef(earlier);
  const examCuesSent = useRef(earlier.examCuesSent);
  const [startedOver, setStartedOver] = useState(false);
  const [helped, setHelped] = useState(false);
  const usedHelp = (earlier.usedHelp && !startedOver) || helped;
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
        setStartedOver(true);
      }

      return {
        length: getCallLength({ answeredAt, callSeconds: minutes * SECONDS_PER_MINUTE, setup }),
        turns: toConversationTurns(before.current.turns),
      };
    },
    [getConnectionTurns, minutes, updateTurns],
  );

  const carry = useCallback(
    ({ live, metLabels }: { live: boolean; metLabels: string[] }) =>
      carryCallSoFar({
        before: before.current,
        connectionId: getConnectionId(),
        examCuesSent: examCuesSent.current,
        live,
        metLabels,
        turns: turnsRef.current,
        usedHelp,
      }),
    [getConnectionId, turnsRef, usedHelp],
  );

  const markHelpUsed = useCallback(() => setHelped(true), []);

  return {
    ...transcript,
    carry,
    continuing: earlier.connectionId !== null && !startedOver,
    examCuesSent,
    getConnectionTurns,
    markHelpUsed,
    prepare,
    usedHelp,
  };
}
