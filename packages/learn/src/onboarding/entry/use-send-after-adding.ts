"use client";

import { startTransition, useEffect, useEffectEvent, useOptimistic, useRef } from "react";
import {
  type AttachOutcome,
  type AttachedSource,
  type GoalAttachActions,
} from "../onboarding-actions";

/**
 * A goal sent while material is still being added waits for it, so the material goes with the goal.
 * When adding fails, nothing is sent and the learner stays to see why.
 *
 * Adding runs in the attach controls' transition, and React holds every transition's updates until
 * it ends, so the count and the busy send are optimistic: both end with it, once the material is in.
 */
export function useSendAfterAdding({
  attach,
  onAdded,
  onSend,
}: {
  attach: GoalAttachActions;
  onAdded: (source: AttachedSource) => void;
  onSend: (goal: string) => void;
}) {
  const [adding, startAdding] = useOptimistic(0, (count, change: number) => count + change);
  const [waiting, showWaiting] = useOptimistic(false);
  const held = useRef<string | null>(null);
  const sendHeld = useEffectEvent(onSend);

  const track = async (run: () => Promise<AttachOutcome>): Promise<AttachOutcome> => {
    startAdding(1);
    const outcome = await run().catch((): AttachOutcome => ({ status: "failed" }));

    if (outcome.status === "attached") {
      onAdded(outcome.source);
    } else {
      held.current = null;
    }

    return outcome;
  };

  useEffect(() => {
    const goal = held.current;

    if (adding === 0 && goal !== null) {
      held.current = null;
      sendHeld(goal);
    }
  }, [adding]);

  const send = (goal: string) => {
    if (adding === 0) {
      onSend(goal);
      return;
    }

    held.current = goal;
    startTransition(() => showWaiting(true));
  };

  return {
    attach: {
      ...attach,
      file: (input) => track(() => attach.file(input)),
      link: (input) => track(() => attach.link(input)),
      text: (input) => track(() => attach.text(input)),
    } satisfies GoalAttachActions,
    send,
    waiting,
  };
}
