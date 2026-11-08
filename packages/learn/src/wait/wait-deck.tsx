"use client";

import { type GoalWarmUp, type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { type ReactNode, createContext, use, useEffect, useState } from "react";
import { type GenerationRun } from "../generation/generation-run";

type ReadDeck = (warmUpId: string) => Promise<WarmUpDeck | null>;

const reading = new Map<string, Promise<WarmUpDeck | null>>();
const read = new Map<string, WarmUpDeck>();

const PageDeckContext = createContext<WarmUpDeck | null>(null);

const ClaimedDeckContext = createContext<GoalWarmUp | null>(null);

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

/** The goal's deck as the onboarding read last reported it: on its way (`writing`) or `ready`. */
export function ClaimedDeckProvider({
  children,
  warmUp,
}: {
  children: ReactNode;
  warmUp: GoalWarmUp | null;
}) {
  return <ClaimedDeckContext value={warmUp}>{children}</ClaimedDeckContext>;
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

/** A ready deck to read: the stream's, the onboarding read's once ready, or the page's. */
function useDeckId(warmUpId: string | undefined) {
  const page = use(PageDeckContext);
  const claimed = use(ClaimedDeckContext);
  const ready = claimed?.status === "ready" ? claimed.id : undefined;

  return { claimed, id: warmUpId ?? ready ?? page?.id, page };
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

/**
 * The goal's deck once it's read, and whether it's still `coming`: claimed or named but not read
 * yet, while the goal's run, which writes it, goes on and hasn't said it won't come. A wait shows
 * the quiz's skeleton meanwhile.
 */
export function useDeck({ readDeck, run }: { readDeck: ReadDeck; run: GenerationRun }) {
  const { claimed, id, page } = useDeckId(run.warmUpId);

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

  const shown = deck?.id === id ? deck : null;

  const going =
    (run.status === "following" || run.status === "waiting") &&
    run.steps.warmUpFailed !== "completed";

  return { coming: !shown && (claimed !== null || id !== undefined) && going, deck: shown };
}
