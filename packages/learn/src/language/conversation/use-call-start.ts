"use client";

import { useLayoutEffect, useState } from "react";
import { type CallLimit } from "../../_components/help-limit-notice";
import { type ContentWriting } from "../../generation/writing-wait";

/**
 * True once the call opens, false when it didn't start, `"paused"` when calls are paused for
 * everyone, the run writing the call when it isn't written yet, or the cap that refused it.
 */
export type CallStartOutcome = boolean | "paused" | { generationId: string } | { limit: CallLimit };

type CallStartState =
  | { generationId: string; status: "writing" }
  | { limit: CallLimit; status: "limited" }
  | { status: "failed" | "idle" | "opened" | "paused" | "starting" };

const IDLE: CallStartState = { status: "idle" };

/** A run that ended with the call still unwritten would loop, so a second ask after it fails. */
function settle({
  afterWrite,
  started,
}: {
  afterWrite: boolean;
  started: CallStartOutcome;
}): CallStartState {
  if (typeof started === "object" && "limit" in started) {
    // Received now: the moment tells a server clock behind this device's from a refusal that's over.
    return { limit: { ...started.limit, receivedAt: Date.now() }, status: "limited" };
  }

  if (started === "paused") {
    return { status: "paused" };
  }

  if (started === true) {
    return { status: "opened" };
  }

  if (started && !afterWrite) {
    return { generationId: started.generationId, status: "writing" };
  }

  return { status: "failed" };
}

export function useCallStart({ onStart }: { onStart: () => Promise<CallStartOutcome> }) {
  const [state, setState] = useState<CallStartState>(IDLE);

  // The router keeps the card's page while its call runs, so back on it that start is over; one
  // still being written keeps its wait.
  useLayoutEffect(
    () => () => setState((current) => (current.status === "opened" ? IDLE : current)),
    [],
  );

  const start = async (afterWrite: boolean) => {
    setState((current) => (current.status === "writing" ? current : { status: "starting" }));
    const started = await onStart().catch(() => false);
    setState(settle({ afterWrite, started }));
  };

  const writing: ContentWriting | null =
    state.status === "writing"
      ? {
          generationId: state.generationId,
          onReady: () => void start(true),
          restart: () => start(false),
        }
      : null;

  return {
    failed: state.status === "failed",
    isStarting: state.status === "starting" || state.status === "opened",
    limit: state.status === "limited" ? state.limit : null,
    paused: state.status === "paused",
    start: () => void start(false),
    writing,
  };
}
