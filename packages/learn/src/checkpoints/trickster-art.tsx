"use client";

import {
  type ActorHandle,
  type TricksterActName,
  TricksterActor,
} from "@zoonk/ui/components/trickster-actor";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * The Trickster as a challenge's art, holding his "?" sign until he's beaten. Where something just
 * happened (`reacts`: the challenge opened, or its result came in), he acts it out a beat in, once:
 * smug while he holds his sign, his defeat once he's beaten (a take, then the slump, his crown
 * sliding over his brow). A revisit draws him still, smug or defeated; without `reacts` he's still,
 * sly or defeated. `ref` makes him act on cue, as at each answer of a duel. `className` sizes him
 * where he's smaller (the duel's aside).
 */
export function TricksterArt({
  beaten = false,
  className,
  reacts = false,
  ref,
}: {
  beaten?: boolean;
  className?: string;
  reacts?: boolean;
  ref?: React.Ref<ActorHandle<TricksterActName>>;
}) {
  return (
    <TricksterActor
      className={cn("size-28 sm:size-32", className)}
      expression={beaten && !reacts ? "defeated" : "sly"}
      pose={beaten ? "sly" : "hero"}
      reaction={reacts ? { act: beaten ? "defeat" : "smug", delay: BEAT_MS } : undefined}
      ref={ref}
    />
  );
}
