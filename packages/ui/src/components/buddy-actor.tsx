"use client";

import { useRef } from "react";
import { BUDDY_ACTS, BUDDY_OPEN_EYES, type BuddyActName } from "./_buddy/buddy-acts";
import { type BuddyExpression } from "./_buddy/buddy-face";
import { type ActorHandle, type AfterBlink, type Reaction, useActor } from "./_character/use-actor";
import { BuddyFigure, type BuddyProps, getBuddyEnergyExpression } from "./buddy";

export { BUDDY_ACTS, type BuddyActName } from "./_buddy/buddy-acts";
export type { ActorHandle, Reaction } from "./_character/use-actor";

const AFTER_BLINK: AfterBlink<BuddyExpression, BuddyActName> = {
  act: "blink",
  faces: BUDDY_OPEN_EYES,
};

/**
 * `reaction` plays once, as its moment plays; where the moment doesn't play (a reload, a revisit)
 * it's drawn still in the act's ending expression. `ref.play(act)` acts on cue instead.
 */
export function BuddyActor({
  expression,
  reaction,
  ref,
  ...props
}: Omit<BuddyProps, "ref"> & {
  reaction?: Reaction<BuddyActName>;
  ref?: React.Ref<ActorHandle<BuddyActName>>;
}) {
  const svg = useRef<SVGSVGElement>(null);

  const actor = useActor({
    acts: BUDDY_ACTS,
    afterBlink: AFTER_BLINK,
    expression: expression ?? getBuddyEnergyExpression(props),
    handle: ref,
    reaction,
    svg,
  });

  return (
    <BuddyFigure {...props} expression={actor.expression} ref={svg} swapFaces={actor.swapFaces} />
  );
}
