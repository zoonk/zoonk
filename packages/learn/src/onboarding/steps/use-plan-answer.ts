"use client";

import { useRef, useState } from "react";
import { type PollStatus, usePoll } from "../../_utils/use-poll";
import { requestWithin } from "../../plan/use-time-to-cover";
import { createRequestLane } from "./request-lane";

const POLL_MS = 3000;

/** After the first answer, days tapped in a row or a picker's wheel passing times ask once. */
const SETTLE_MS = 300;

function settle(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, SETTLE_MS);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export type PlanAnswer<Answer> = {
  /** The answer for what's asked about now; null while it's on its way. */
  answer: Answer | null;
  /** The first ready answer the screen got. */
  first: Answer | null;
  /** The answer for what's asked about now, or else the last one that came. */
  last: Answer | null;
  restart: () => void;
  status: PollStatus;
};

type Answered<Answer> = {
  byKey: ReadonlyMap<string, Answer>;
  first: Answer | null;
  last: Answer | null;
};

/**
 * Asks every few seconds while the plan isn't ready, then once for each new `key`, keeping each
 * answer so going back to an earlier choice needs no new one; `paused` stops asking again a plan
 * whose run stopped. Each ask plans the goal, so one is out at a time and the latest `key` goes next.
 */
export function usePlanAnswer<Answer extends { ready: boolean }>({
  ask,
  enabled,
  key,
  paused,
}: {
  ask: () => Promise<Answer | null>;
  enabled: boolean;
  key: string;
  paused: boolean;
}): PlanAnswer<Answer> {
  const [answered, setAnswered] = useState<Answered<Answer>>({
    byKey: new Map(),
    first: null,
    last: null,
  });

  const lane = useRef(createRequestLane());
  const answer = answered.byKey.get(key) ?? null;

  const poll = usePoll({
    active: enabled && !answer?.ready && !(paused && answer !== null),
    intervalMs: POLL_MS,
    key,
    onPoll: async (signal) => {
      if (answered.last) {
        await settle(signal);
      }

      const next = await lane.current({ request: () => requestWithin(ask), signal });

      if (!next) {
        if (signal.aborted) {
          return;
        }

        throw new Error("The plan couldn't be asked about the schedule");
      }

      setAnswered((current) => ({
        byKey: new Map(current.byKey).set(key, next),
        first: current.first ?? (next.ready ? next : null),
        last: next,
      }));
    },
  });

  return {
    answer,
    first: answered.first,
    last: answer ?? answered.last,
    restart: poll.restart,
    status: poll.status,
  };
}
