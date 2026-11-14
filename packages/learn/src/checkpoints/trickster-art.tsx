"use client";

import { Burst } from "@zoonk/ui/components/burst";
import {
  type ActorHandle,
  type TricksterActName,
  TricksterActor,
} from "@zoonk/ui/components/trickster-actor";
import { BEAT_MS, STAGGER_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";

/** How a duel ended for the learner. */
type DuelOutcome = "lost" | "won";

const STILL = { lost: "smug", won: "defeated" } as const;
const ACT = { lost: "triumph", won: "defeat" } as const;

/**
 * The Trickster behind his shield. A decided duel draws how it ended: the shield in two halves at
 * his feet, or whole in front of him. `reacts` plays that ending once, as the moment plays, and
 * `breaks` adds the sparks where a duel plays the ending itself.
 */
export function TricksterArt({
  breaks = false,
  className,
  cracks = 0,
  outcome,
  reacts = false,
  ref,
}: {
  breaks?: boolean;
  className?: string;
  cracks?: 0 | 1 | 2;
  outcome?: DuelOutcome;
  reacts?: boolean;
  ref?: React.Ref<ActorHandle<TricksterActName>>;
}) {
  const act = outcome ? ACT[outcome] : "smug";
  const wins = reacts && outcome === "won";

  return (
    <span className="relative flex shrink-0" data-slot="trickster-art">
      <TricksterActor
        className={cn("size-28 sm:size-32", className)}
        cracks={cracks}
        expression={outcome && !reacts ? STILL[outcome] : "sly"}
        reaction={reacts ? { act, delayMs: BEAT_MS } : undefined}
        ref={ref}
      />
      {(breaks || wins) && (
        <Burst
          className="text-warning top-[73%] left-[18%]"
          delayMs={wins ? BEAT_MS + STAGGER_MS : STAGGER_MS}
        />
      )}
    </span>
  );
}
