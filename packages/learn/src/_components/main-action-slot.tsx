"use client";

import { createContext, use, useLayoutEffect, useState } from "react";

type Place = (action: React.ReactNode) => void;

const PlaceContext = createContext<Place | null>(null);
const PlacedContext = createContext<React.ReactNode>(null);

export function MainActionSlotProvider({ children }: { children: React.ReactNode }) {
  const [placed, setPlaced] = useState<React.ReactNode>(null);

  return (
    <PlaceContext value={setPlaced}>
      <PlacedContext value={placed}>{children}</PlacedContext>
    </PlaceContext>
  );
}

/** Around the bar's own main action: a question's action takes its place while it has one. */
export function MainActionSlot({ children }: { children: React.ReactNode }) {
  return use(PlacedContext) ?? children;
}

/** Whether a question placed its action in the bar; the caller renders again whenever that action changes. */
export function useHasPlacedMainAction(): boolean {
  return use(PlacedContext) !== null;
}

/**
 * A question answered by something other than "Check" (a recording) draws its main action in the
 * bar, where Check is, in reach of a thumb. Without a bar that offers the slot it stays in place.
 */
export function MainActionInBar({ children }: { children: React.ReactNode }) {
  const place = use(PlaceContext);

  useLayoutEffect(() => {
    place?.(children);
  }, [children, place]);

  useLayoutEffect(() => () => place?.(null), [place]);

  return place ? null : children;
}
