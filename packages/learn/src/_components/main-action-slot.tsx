"use client";

import { createContext, use, useLayoutEffect, useState } from "react";

type Placed = { action: React.ReactNode; note: React.ReactNode };

type Place = (placed: Placed | null) => void;

const PlaceContext = createContext<Place | null>(null);
const PlacedContext = createContext<Placed | null>(null);

export function MainActionSlotProvider({ children }: { children: React.ReactNode }) {
  const [placed, setPlaced] = useState<Placed | null>(null);

  return (
    <PlaceContext value={setPlaced}>
      <PlacedContext value={placed}>{children}</PlacedContext>
    </PlaceContext>
  );
}

/** Around the bar's own main action: a question's action takes its place while it has one. */
export function MainActionSlot({ children }: { children: React.ReactNode }) {
  return use(PlacedContext)?.action ?? children;
}

/** Whether a question placed its action in the bar; the caller renders again whenever that action changes. */
export function useHasPlacedMainAction(): boolean {
  return use(PlacedContext) !== null;
}

export function usePlacedMainActionNote(): React.ReactNode {
  return use(PlacedContext)?.note ?? null;
}

/**
 * A question answered by something other than "Check" (a recording) draws its main action in the
 * bar, where Check is, in reach of a thumb, with the line about it (`note`) right over the bar.
 * Without a bar that offers the slot both stay in place.
 */
export function MainActionInBar({
  children,
  note = null,
}: {
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  const place = use(PlaceContext);

  useLayoutEffect(() => {
    place?.({ action: children, note });
  }, [children, note, place]);

  useLayoutEffect(() => () => place?.(null), [place]);

  if (place) {
    return null;
  }

  return (
    <>
      {note}
      {children}
    </>
  );
}
