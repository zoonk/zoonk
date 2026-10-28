"use client";

import { useEffect, useEffectEvent, useState } from "react";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const MAX_ERRORS_IN_A_ROW = 3;

export type PollStatus = "failed" | "idle" | "polling" | "timedOut";

type Stop = { round: number; status: "failed" | "timedOut" };

export function usePoll({
  active,
  intervalMs,
  key,
  onPoll,
  startNow = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  active: boolean;
  intervalMs: number;
  key?: string;
  /** A thrown error counts toward giving up; `signal` aborts once the round is over. */
  onPoll: (signal: AbortSignal) => unknown;
  startNow?: boolean;
  timeoutMs?: number;
}): { restart: () => void; status: PollStatus } {
  const poll = useEffectEvent(onPoll);
  const [round, setRound] = useState(0);
  const [stop, setStop] = useState<Stop | null>(null);
  const [wasActive, setWasActive] = useState(active);
  const [wasKey, setWasKey] = useState(key);

  if (active !== wasActive || key !== wasKey) {
    setWasActive(active);
    setWasKey(key);

    if (active) {
      setRound(round + 1);
    }
  }

  const stopped = stop?.round === round ? stop.status : null;

  useEffect(() => {
    if (!active || stopped) {
      return;
    }

    const run = new AbortController();
    let errors = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        await poll(run.signal);
        errors = 0;
      } catch {
        errors += 1;
      }

      if (run.signal.aborted) {
        return;
      }

      if (errors >= MAX_ERRORS_IN_A_ROW || Date.now() - startedAt >= timeoutMs) {
        setStop({ round, status: errors >= MAX_ERRORS_IN_A_ROW ? "failed" : "timedOut" });
        return;
      }

      timer = setTimeout(() => void tick(), intervalMs);
    };

    timer = setTimeout(() => void tick(), startNow ? 0 : intervalMs);

    return () => {
      run.abort();
      clearTimeout(timer);
    };
  }, [active, intervalMs, round, startNow, stopped, timeoutMs]);

  return {
    restart: () => setRound((current) => current + 1),
    status: active ? (stopped ?? "polling") : "idle",
  };
}
