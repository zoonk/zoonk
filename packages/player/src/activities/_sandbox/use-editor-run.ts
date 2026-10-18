"use client";

import { useEffect, useRef, useState } from "react";

/** A run may show old output, but only its unchanged editor revision can supply an answer. */
export function useEditorRun() {
  const revision = useRef(0);
  const active = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isStale, setIsStale] = useState(false);

  useEffect(
    () => () => {
      active.current = null;
      revision.current += 1;
      setIsRunning(false);
    },
    [],
  );

  function edit() {
    revision.current += 1;
    setIsStale(true);
  }

  function start(): number | null {
    if (active.current !== null) {
      return null;
    }

    active.current = revision.current;
    setIsRunning(true);
    return revision.current;
  }

  function finish(startedRevision: number): "cancelled" | "current" | "stale" {
    if (active.current !== startedRevision) {
      return "cancelled";
    }

    active.current = null;
    const current = revision.current === startedRevision;
    setIsRunning(false);
    setIsStale(!current);
    return current ? "current" : "stale";
  }

  return { edit, finish, isRunning, isStale, start };
}
