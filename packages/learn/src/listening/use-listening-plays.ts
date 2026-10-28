"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { tabStorage } from "../_utils/device-storage";

const STORAGE_PREFIX = "zoonk:listening-played:";

type PlaysState = { played: number; playing: boolean; restart: "given" | "none" | "used" };

const NO_PLAYS: PlaysState = { played: 0, playing: false, restart: "none" };

/** `useSyncExternalStore` needs the same object while nothing changes. */
const states = new Map<string, PlaysState>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isPlaysState(value: unknown): value is PlaysState {
  return typeof value === "object" && value !== null && "played" in value && "restart" in value;
}

function readStored(playsKey: string): PlaysState {
  const stored = tabStorage.getJson(`${STORAGE_PREFIX}${playsKey}`);
  return isPlaysState(stored) ? stored : NO_PLAYS;
}

function readState(playsKey: string): PlaysState {
  const known = states.get(playsKey) ?? readStored(playsKey);
  states.set(playsKey, known);
  return known;
}

function update(playsKey: string, change: (state: PlaysState) => PlaysState) {
  const state = readState(playsKey);
  const next = change(state);

  if (next === state) {
    return;
  }

  states.set(playsKey, next);

  tabStorage.set(`${STORAGE_PREFIX}${playsKey}`, JSON.stringify(next));

  for (const listener of listeners) {
    listener();
  }
}

function startPlay(state: PlaysState): PlaysState {
  return {
    played: state.played + 1,
    playing: true,
    restart: state.restart === "given" ? "used" : state.restart,
  };
}

function endPlay(state: PlaysState): PlaysState {
  return state.playing ? { ...state, playing: false } : state;
}

function interruptPlay({
  restartOnce,
  state,
}: {
  restartOnce: boolean;
  state: PlaysState;
}): PlaysState {
  if (!state.playing) {
    return state;
  }

  if (restartOnce && state.restart === "none") {
    return { played: state.played - 1, playing: false, restart: "given" };
  }

  return { ...state, playing: false };
}

/** Exam fidelity, not security: the file is public. A play under way as the recording mounts was cut off. */
export function useListeningPlays({
  playsKey,
  restartOnce,
}: {
  playsKey: string;
  restartOnce: boolean;
}) {
  const state = useSyncExternalStore(
    subscribe,
    () => readState(playsKey),
    () => NO_PLAYS,
  );

  useEffect(() => {
    update(playsKey, (current) => interruptPlay({ restartOnce, state: current }));
  }, [playsKey, restartOnce]);

  const onPlayed = useCallback(() => update(playsKey, startPlay), [playsKey]);
  const onEnded = useCallback(() => update(playsKey, endPlay), [playsKey]);

  const onInterrupted = useCallback(
    () => update(playsKey, (current) => interruptPlay({ restartOnce, state: current })),
    [playsKey, restartOnce],
  );

  return {
    onEnded,
    onInterrupted,
    onPlayed,
    played: state.played,
    restarted: state.restart === "given",
  };
}
