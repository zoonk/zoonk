"use client";

import { useEffect, useState } from "react";
import { type ReadyHold, getReadyHold } from "./ready-hold";

const QUIET_MS = 1000;

export type ReadyHoldControl = {
  /** For the warm-up card: called on each guess on this screen. */
  onGuess: () => void;
  /** For the main button a held screen pins. */
  release: () => void;
  status: ReadyHold;
};

/** Every wait that shows a warm-up card moves on through this, so they all follow one rule. */
export function useReadyHold(ready: boolean): ReadyHoldControl {
  const [guessed, setGuessed] = useState(false);
  const [released, setReleased] = useState(false);
  const [touched, setTouched] = useState(false);
  const status = getReadyHold({ guessed, ready, released, touched });
  const showing = status !== "go";

  useEffect(() => {
    if (!showing) {
      return;
    }

    let quiet: ReturnType<typeof setTimeout> | undefined;

    const touch = () => {
      setTouched(true);
      clearTimeout(quiet);
      quiet = setTimeout(() => setTouched(false), QUIET_MS);
    };

    document.addEventListener("pointerdown", touch, true);
    document.addEventListener("keydown", touch, true);

    return () => {
      clearTimeout(quiet);
      document.removeEventListener("pointerdown", touch, true);
      document.removeEventListener("keydown", touch, true);
    };
  }, [showing]);

  return { onGuess: () => setGuessed(true), release: () => setReleased(true), status };
}
