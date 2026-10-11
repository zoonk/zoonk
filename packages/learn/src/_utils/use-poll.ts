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
 * the plan, a level test), starting right away and one request at a time for each `key`. It stops
 * when `active` turns false, and never gives up silently: requests that keep throwing, or asking
 * for longer than `timeoutMs`, stop it with a status the screen shows, and `restart` asks again.
 * Turning it on again, or asking about something else (`key`) while on, starts afresh.
 */
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
  /**
   * What it asks about. When it changes while asking, it asks about the new one right away, without
   * waiting for the answer about the old one (which can take seconds) and the pause after it.
   */
  key?: string;
  /**
   * One request; a thrown error counts toward giving up. `signal` aborts once its round is over
   * (turned off, or another `key`), so an answer that comes after it can be dropped.
   */
  onPoll: (signal: AbortSignal) => unknown;
  /**
   * False for a page that reads itself again: it was just read, so the first ask waits an interval
   * (asking at once read a real-size plan twice on every visit).
   */
  startNow?: boolean;
  timeoutMs?: number;
}): { restart: () => void; status: PollStatus } {
  const poll = useEffectEvent(onPoll);
  const [round, setRound] = useState(0);
  const [stop, setStop] = useState<Stop | null>(null);
  const [wasActive, setWasActive] = useState(active);
  const [wasKey, setWasKey] = useState(key);

  // Each time it turns on, or asks about something else, is a new round, with its own errors and
  // time.
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
