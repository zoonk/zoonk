"use client";

import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { useEffect, useState } from "react";

type ReadDeck = (warmUpId: string) => Promise<WarmUpDeck | null>;

const reading = new Map<string, Promise<WarmUpDeck | null>>();
const read = new Map<string, WarmUpDeck>();

/**
 * Read once while the page is open: every wait of this onboarding deals from the same deck, and one
 * read while the learner still answers questions has the card there as the wait opens.
 */
export function preloadDeck({ readDeck, warmUpId }: { readDeck: ReadDeck; warmUpId: string }) {
  const known = reading.get(warmUpId);

  if (known) {
    return known;
  }

  const next = readDeck(warmUpId)
    .then((deck) => {
      if (deck) {
        read.set(warmUpId, deck);
      }

      return deck;
    })
    .catch(() => {
      reading.delete(warmUpId);
      return null;
    });

  reading.set(warmUpId, next);
  return next;
}

export function useDeck({ readDeck, warmUpId }: { readDeck: ReadDeck; warmUpId?: string }) {
  const [deck, setDeck] = useState(() => (warmUpId ? (read.get(warmUpId) ?? null) : null));

  useEffect(() => {
    if (!warmUpId) {
      return;
    }

    let current = true;

    void preloadDeck({ readDeck, warmUpId }).then((found) => {
      if (current) {
        setDeck(found);
      }
    });

    return () => {
      current = false;
    };
  }, [readDeck, warmUpId]);

  return deck?.id === warmUpId ? deck : null;
}
