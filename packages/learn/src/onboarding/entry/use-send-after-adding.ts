"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  type AttachOutcome,
  type AttachedSource,
  type GoalAttachActions,
} from "../onboarding-actions";

/**
 * A goal sent while material is still being added waits for it, so the material goes with the goal.
 * When adding fails, nothing is sent and the learner stays to see why.
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
  const [adding, setAdding] = useState(0);
  const [held, setHeld] = useState<{ goal: string } | null>(null);
  const sent = useRef<{ goal: string } | null>(null);
  const sendHeld = useEffectEvent(onSend);

  // The count drops in the same update that adds the material, so the held goal never goes without it.
  const track = async (run: () => Promise<AttachOutcome>): Promise<AttachOutcome> => {
    setAdding((count) => count + 1);
    const outcome = await run().catch((): AttachOutcome => ({ status: "failed" }));
    setAdding((count) => count - 1);

    if (outcome.status === "attached") {
      onAdded(outcome.source);
    } else {
      setHeld(null);
    }

    return outcome;
  };

  useEffect(() => {
    if (held && adding === 0 && sent.current !== held) {
      sent.current = held;
      sendHeld(held.goal);
    }
  }, [adding, held]);

  return {
    attach: {
      ...attach,
      file: (input) => track(() => attach.file(input)),
      link: (input) => track(() => attach.link(input)),
      text: (input) => track(() => attach.text(input)),
    } satisfies GoalAttachActions,
    held: held !== null && adding > 0,
    send: (goal: string) => (adding > 0 ? setHeld({ goal }) : onSend(goal)),
  };
}
