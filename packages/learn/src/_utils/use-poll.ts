"use client";

import { useEffect, useEffectEvent, useState } from "react";

/** A wait never goes on silently: after this long without the caller turning it off, it stops. */
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/** Requests that threw in a row (the server can't be reached) before polling stops. */
const MAX_ERRORS_IN_A_ROW = 3;

/**
 * `polling` while it asks, `idle` while inactive, `failed` once asking kept throwing, and
 * `timedOut` once it asked for `timeoutMs` without the caller turning it off.
 */
export type PollStatus = "failed" | "idle" | "polling" | "timedOut";

type Stop = { round: number; status: "failed" | "timedOut" };

/**
 * Asks again every few seconds while something is being made in the background (the skill map,
 * the plan, a level test), starting right away and one request at a time. It stops when `active`
 * turns false, and never gives up silently: requests that keep throwing, or asking for longer than
 * `timeoutMs`, stop it with a status the screen shows, and `restart` asks again. Turning it on
 * again starts afresh.
 */
export function usePoll({
  active,
  intervalMs,
  onPoll,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  active: boolean;
  intervalMs: number;
  /** One request; a thrown error counts toward giving up. */
  onPoll: () => unknown;
  timeoutMs?: number;
}): { restart: () => void; status: PollStatus } {
  const poll = useEffectEvent(onPoll);
  const [round, setRound] = useState(0);
  const [stop, setStop] = useState<Stop | null>(null);
  const [wasActive, setWasActive] = useState(active);

  // Each time it turns on is a new round, with its own errors and time.
  if (active !== wasActive) {
    setWasActive(active);

    if (active) {
      setRound(round + 1);
    }
  }

  const stopped = stop?.round === round ? stop.status : null;

  useEffect(() => {
    if (!active || stopped) {
      return;
    }

    let cancelled = false;
    let errors = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        await poll();
        errors = 0;
      } catch {
        errors += 1;
      }

      if (cancelled) {
        return;
      }

      if (errors >= MAX_ERRORS_IN_A_ROW || Date.now() - startedAt >= timeoutMs) {
        setStop({ round, status: errors >= MAX_ERRORS_IN_A_ROW ? "failed" : "timedOut" });
        return;
      }

      timer = setTimeout(() => void tick(), intervalMs);
    };

    timer = setTimeout(() => void tick(), 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, intervalMs, round, stopped, timeoutMs]);

  return {
    restart: () => setRound((current) => current + 1),
    status: active ? (stopped ?? "polling") : "idle",
  };
}
