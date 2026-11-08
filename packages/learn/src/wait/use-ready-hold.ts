"use client";

import { useEffect, useState } from "react";
import { type ReadyHold, getReadyHold } from "./ready-hold";

const QUIET_MS = 1000;

export type ReadyHoldControl = {
  /** Called on a guess, on opening the progress and on choosing the quiz. */
  engage: () => void;
  /** For the main button a held screen pins. */
  release: () => void;
  status: ReadyHold;
};

/** Every wait moves on through this, so they all follow one rule. */
export function useReadyHold(ready: boolean): ReadyHoldControl {
  const [engaged, setEngaged] = useState(false);
  const [released, setReleased] = useState(false);
  const [touched, setTouched] = useState(false);
  const status = getReadyHold({ engaged, ready, released, touched });
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

  return { engage: () => setEngaged(true), release: () => setReleased(true), status };
}
