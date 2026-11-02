"use client";

import {
  type ActorHandle,
  type TricksterActName,
  TricksterActor,
} from "@zoonk/ui/components/trickster-actor";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";

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
      reaction={reacts ? { act: beaten ? "defeat" : "smug", delayMs: BEAT_MS } : undefined}
      ref={ref}
    />
  );
}
