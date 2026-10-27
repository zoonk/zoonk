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
 * The buddy, acting: it shows `expression` still (its Energy's face without one), and its parts
 * perform an act (`BUDDY_ACTS`: a blink, a glance, a smile forming, a cheer, surprise, pride),
 * landing in the act's expression. It never moves as one block. With reduced motion an act only
 * changes the face.
 *
 * `reaction` is what it does because something happened, once, as the moment it's in plays: the
 * act on the moment's beat, then one blink a while later if its eyes are open. Anywhere the moment
 * doesn't play (a reload, a revisit, the way back) it's drawn still in the expression the act lands
 * in. `ref.play(act)` makes it act on cue instead, such as when its answer comes in.
 *
 * ```tsx
 * <BuddyActor {...buddy} expression="happy" reaction={{ act: "cheer", delay: 2 * BEAT_MS }} />
 * ```
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
