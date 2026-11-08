"use client";

import { type WarmUpSurface } from "@zoonk/core/analytics/events";
import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { useEffect, useState } from "react";
import { type ReadyHoldControl } from "../../warm-up/use-ready-hold";
import { WarmUpCard } from "../../warm-up/warm-up-card";
import { type OnboardingActions } from "../onboarding-actions";

type ReadWarmUp = OnboardingActions["readWarmUp"];

const decks = new Map<string, Promise<WarmUpDeck | null>>();

/** Read once while the page is open: every wait of this onboarding deals from the same deck. */
function readDeck({ read, warmUpId }: { read: ReadWarmUp; warmUpId: string }) {
  const known = decks.get(warmUpId);

  if (known) {
    return known;
  }

  const reading = read(warmUpId).catch(() => {
    decks.delete(warmUpId);
    return null;
  });

  decks.set(warmUpId, reading);
  return reading;
}

function useDeck({ read, warmUpId }: { read: ReadWarmUp; warmUpId?: string }) {
  const [deck, setDeck] = useState<WarmUpDeck | null>(null);

  useEffect(() => {
    if (!warmUpId) {
      return;
    }

    let current = true;

    void readDeck({ read, warmUpId }).then((found) => {
      if (current) {
        setDeck(found);
      }
    });

    return () => {
      current = false;
    };
  }, [read, warmUpId]);

  return deck?.id === warmUpId ? deck : null;
}

/** Shows once the run reports the goal's deck; nothing above it moves when it arrives. */
export function WaitWarmUp({
  hold,
  read,
  surface,
  warmUpId,
}: {
  hold: ReadyHoldControl;
  read: ReadWarmUp;
  surface: WarmUpSurface;
  warmUpId?: string;
}) {
  const deck = useDeck({ read, warmUpId });

  return (
    deck && (
      <WarmUpCard
        deck={deck}
        holding={hold.status === "hold"}
        onGuess={hold.onGuess}
        surface={surface}
      />
    )
  );
}
