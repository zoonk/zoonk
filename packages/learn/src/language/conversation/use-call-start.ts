"use client";

import { useState } from "react";
import { type GenerationRun } from "../../generation/generation-run";

/** A call written ahead starts well within this; a slower start is a model writing the call. */
const WRITING_AFTER_MS = 1000;

type CallStartState = "failed" | "idle" | "ready" | "starting" | "writeFailed" | "writing";

/** Where a start stands once `onStart` answered, from where it stood while waiting. */
function settle({ current, started }: { current: CallStartState; started: boolean }) {
  const wasWriting = current === "writing";

  if (started) {
    // The call opens next: the button keeps saying so, or the wait shows it's done.
    return wasWriting ? "ready" : "starting";
  }

  return wasWriting ? "writeFailed" : "failed";
}

/** The wait's view of a start that's writing its call; null while the card shows its button. */
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

/**
 * Starting a language call from a card, one request that opens the call when it's done. A call
 * written ahead starts at once, with "Starting…" on the button. One that isn't written yet takes a
 * model about half a minute, so once the start runs longer than a written call would, `run` shows
 * that wait for `step` (a step of the card's generation kind) until the call opens, or until it
 * didn't start, with a way to try again. `onStart` resolves false when the call didn't start.
 */
export function useCallStart({ onStart, step }: { onStart: () => Promise<boolean>; step: string }) {
  const [state, setState] = useState<CallStartState>("idle");

  const start = async () => {
    // Trying again after the call couldn't be written writes it again, so the wait stays.
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
    isStarting: state === "starting",
    run: toRun({ retry: () => void start(), state, step }),
    start: () => void start(),
  };
}
