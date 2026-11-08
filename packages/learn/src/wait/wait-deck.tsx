"use client";

import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { type ReactNode, createContext, use, useEffect, useState } from "react";

type ReadDeck = (warmUpId: string) => Promise<WarmUpDeck | null>;

const reading = new Map<string, Promise<WarmUpDeck | null>>();
const read = new Map<string, WarmUpDeck>();

const PageDeckContext = createContext<WarmUpDeck | null>(null);

/**
 * The goal's deck read with the page, so a wait the page opens on draws its card from the first
 * frame; the run's stream names the deck only after the page loads.
 */
export function PageDeckProvider({
  children,
  deck,
}: {
  children: ReactNode;
  deck: WarmUpDeck | null;
}) {
  return <PageDeckContext value={deck}>{children}</PageDeckContext>;
}

/**
 * Read once while the page is open: every wait of this onboarding deals from the same deck, and one
 * read while the learner still answers questions has the card there as the wait opens.
 */
function preloadDeck({
  page,
  readDeck,
  warmUpId,
}: {
  page: WarmUpDeck | null;
  readDeck: ReadDeck;
  warmUpId: string;
}) {
  const known = reading.get(warmUpId);

  if (known) {
    return known;
  }

  const next = (page?.id === warmUpId ? Promise.resolve(page) : readDeck(warmUpId))
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

/** The stream's deck, or the page's until the stream names one. */
function useDeckId(warmUpId: string | undefined) {
  const page = use(PageDeckContext);
  return { id: warmUpId ?? page?.id, page };
}

/** While the learner answers questions, so the quiz is there as soon as a wait opens. */
export function usePreloadedDeck({
  readDeck,
  warmUpId,
}: {
  readDeck: ReadDeck;
  warmUpId?: string;
}) {
  const { id, page } = useDeckId(warmUpId);

  useEffect(() => {
    if (id) {
      void preloadDeck({ page, readDeck, warmUpId: id });
    }
  }, [id, page, readDeck]);
}

export function useDeck({ readDeck, warmUpId }: { readDeck: ReadDeck; warmUpId?: string }) {
  const { id, page } = useDeckId(warmUpId);

  const [deck, setDeck] = useState(() =>
    id ? (read.get(id) ?? (page?.id === id ? page : null)) : null,
  );

  useEffect(() => {
    if (!id) {
      return;
    }

    let current = true;

    void preloadDeck({ page, readDeck, warmUpId: id }).then((found) => {
      if (current) {
        setDeck(found);
      }
    });

    return () => {
      current = false;
    };
  }, [id, page, readDeck]);

  return deck?.id === id ? deck : null;
}
