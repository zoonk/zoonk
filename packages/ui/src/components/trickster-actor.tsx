"use client";

import { useRef } from "react";
import { type ActorHandle, useActor } from "./_character/use-actor";
import { TRICKSTER_ACTS, type TricksterActName } from "./_trickster/trickster-acts";
import { TRICKSTER_POSES, TricksterFigure, type TricksterProps } from "./trickster";

export { TRICKSTER_ACTS, type TricksterActName } from "./_trickster/trickster-acts";
export type { ActorHandle } from "./_character/use-actor";

/**
 * The Trickster, acting: he shows `expression` still, and `ref.play(act)` makes his parts perform
 * (`TRICKSTER_ACTS`: a blink, smug, defeated), landing in the act's expression and pose. He never
 * moves as one block. With reduced motion an act only changes his face and pose.
 */
export function TricksterActor({
  expression = "sly",
  ref,
  ...props
}: Omit<TricksterProps, "ref"> & { ref?: React.Ref<ActorHandle<TricksterActName>> }) {
  const svg = useRef<SVGSVGElement>(null);

  const actor = useActor({
    acts: TRICKSTER_ACTS,
    expression,
    handle: ref,
    poses: TRICKSTER_POSES,
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
