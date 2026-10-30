"use client";

import { useEffect, useRef, useState } from "react";

export function useEditorRun({ isChecked }: { isChecked: boolean }) {
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

  // A run still going at Check ends unseen, so the checked answer keeps the output it was graded on.
  useEffect(() => {
    if (isChecked) {
      active.current = null;
    }
  }, [isChecked]);

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
      setIsRunning(false);
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
