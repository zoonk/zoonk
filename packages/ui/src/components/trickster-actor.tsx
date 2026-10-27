"use client";

import { useRef } from "react";
import { type ActorHandle, type AfterBlink, type Reaction, useActor } from "./_character/use-actor";
import {
  TRICKSTER_ACTS,
  TRICKSTER_OPEN_EYES,
  type TricksterActName,
} from "./_trickster/trickster-acts";
import {
  TRICKSTER_POSES,
  type TricksterExpression,
  TricksterFigure,
  type TricksterProps,
} from "./trickster";

export { TRICKSTER_ACTS, type TricksterActName } from "./_trickster/trickster-acts";
export type { ActorHandle, Reaction } from "./_character/use-actor";

const AFTER_BLINK: AfterBlink<TricksterExpression, TricksterActName> = {
  act: "blink",
  faces: TRICKSTER_OPEN_EYES,
};

/**
 * The Trickster, acting: he shows `expression` still, and his parts perform an act
 * (`TRICKSTER_ACTS`: a blink, smug, back to sly, defeated), landing in the act's expression and
 * pose. He never moves as one block. With reduced motion an act only changes his face and pose.
 *
 * `reaction` is what he does because something happened, once, as the moment he's in plays: the
 * act on the moment's beat, then one blink a while later. Anywhere the moment doesn't play (a
 * reload, a revisit, the way back) he's drawn still in the expression the act lands in.
 * `ref.play(act)` makes him act on cue instead, such as at each answer of a duel.
 */
export function TricksterActor({
  expression = "sly",
  reaction,
  ref,
  ...props
}: Omit<TricksterProps, "ref"> & {
  reaction?: Reaction<TricksterActName>;
  ref?: React.Ref<ActorHandle<TricksterActName>>;
}) {
  const svg = useRef<SVGSVGElement>(null);

  const actor = useActor({
    acts: TRICKSTER_ACTS,
    afterBlink: AFTER_BLINK,
    expression,
    handle: ref,
    poses: TRICKSTER_POSES,
    reaction,
    svg,
  });

  return (
    <TricksterFigure
      {...props}
      expression={actor.expression}
      ref={svg}
      swapFaces={actor.swapFaces}
    />
  );
}
