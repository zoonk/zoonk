"use client";

import { useRef } from "react";
import { BUDDY_ACTS, type BuddyActName } from "./_buddy/buddy-acts";
import { type ActorHandle, useActor } from "./_character/use-actor";
import { BuddyFigure, type BuddyProps } from "./buddy";

export { BUDDY_ACTS, type BuddyActName } from "./_buddy/buddy-acts";
export type { ActorHandle } from "./_character/use-actor";

/**
 * The buddy, acting: it shows `expression` still, and `ref.play(act)` makes its parts perform
 * (`BUDDY_ACTS`: a blink, a glance, a smile forming, a cheer, surprise, pride), landing in the act's
 * expression. It never moves as one block. With reduced motion an act only changes the face.
 */
export function BuddyActor({
  expression = "happy",
  ref,
  ...props
}: Omit<BuddyProps, "ref"> & { ref?: React.Ref<ActorHandle<BuddyActName>> }) {
  const svg = useRef<SVGSVGElement>(null);
  const actor = useActor({ acts: BUDDY_ACTS, expression, handle: ref, svg });

  return (
    <BuddyFigure {...props} expression={actor.expression} ref={svg} swapFaces={actor.swapFaces} />
  );
}
