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
 * `reaction` plays once, as its moment plays; where the moment doesn't play (a reload, a revisit)
 * he's drawn still in the act's ending expression. `ref.play(act)` acts on cue instead.
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
