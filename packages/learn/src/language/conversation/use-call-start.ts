"use client";

import { useLayoutEffect, useState } from "react";
import { type GenerationRun } from "../../generation/generation-run";

/** A call written ahead starts well within this, so a slower start is a model writing it. */
const WRITING_AFTER_MS = 1000;

type CallStartState =
  | "failed"
  | "idle"
  | "opened"
  | "ready"
  | "starting"
  | "writeFailed"
  | "writing";

function settle({ current, started }: { current: CallStartState; started: boolean }) {
  const wasWriting = current === "writing";

  if (started) {
    return wasWriting ? "ready" : "opened";
  }

  return wasWriting ? "writeFailed" : "failed";
}

function toRun({
  retry,
  state,
  step,
}: {
  retry: () => void;
  state: CallStartState;
  step: string;
}): GenerationRun | null {
  if (state === "writing") {
    return { failure: null, status: "following", steps: { [step]: "started" } };
  }

  if (state === "ready") {
    return { failure: null, status: "ready", steps: { [step]: "completed" } };
  }

  if (state === "writeFailed") {
    return { failure: "notStarted", retry, status: "failed", steps: {} };
  }

  return null;
}

/** `onStart` resolves false when the call didn't start. */
export function useCallStart({ onStart, step }: { onStart: () => Promise<boolean>; step: string }) {
  const [state, setState] = useState<CallStartState>("idle");

  // The router keeps the card's page while its call runs, so back on it that start is over; one
  // still waiting keeps its wait.
  useLayoutEffect(
    () => () =>
      setState((current) => (current === "opened" || current === "ready" ? "idle" : current)),
    [],
  );

  const start = async () => {
    setState((current) => (current === "writeFailed" ? "writing" : "starting"));

    const writing = setTimeout(() => {
      setState((current) => (current === "starting" ? "writing" : current));
    }, WRITING_AFTER_MS);

    const started = await onStart().catch(() => false);

    clearTimeout(writing);
    setState((current) => settle({ current, started }));
  };

  return {
    failed: state === "failed",
    isStarting: state === "starting" || state === "opened",
    run: toRun({ retry: () => void start(), state, step }),
    start: () => void start(),
  };
}
