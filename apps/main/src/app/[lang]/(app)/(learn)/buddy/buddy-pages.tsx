"use client";

import { createContext, use, useState } from "react";
import { type BuddyPageRead } from "./buddy-first-page";

function createBuddyPages() {
  const read = new Map<string, NonNullable<BuddyPageRead["thread"]>>();
  const ofAnotherGoal = new Set<string>();

  return {
    isOfAnotherGoal: (conversationId: string) => ofAnotherGoal.has(conversationId),
    keep: ({ conversationId, ofAnotherGoal: elsewhere = false, thread }: BuddyPageRead) => {
      if (!conversationId) {
        return;
      }

      if (thread) {
        read.set(conversationId, thread);
      }

      if (elsewhere) {
        ofAnotherGoal.add(conversationId);
      } else {
        ofAnotherGoal.delete(conversationId);
      }
    },
    /** Null for a conversation no page read, which then loads itself. */
    readOf: (conversationId: string) => read.get(conversationId) ?? null,
  };
}

const BuddyPagesContext = createContext<ReturnType<typeof createBuddyPages> | null>(null);

/**
 * What the buddy's pages read of the conversations their URLs named. The layout draws the
 * conversation, so a page draws nothing and keeps its read here, while rendering, as the page is
 * drawn before the conversation.
 */
export function BuddyPages({ children }: { children: React.ReactNode }) {
  // oxlint-disable-next-line react/hook-use-state -- Made once and never replaced, so there is no setter.
  const [pages] = useState(createBuddyPages);
  return <BuddyPagesContext value={pages}>{children}</BuddyPagesContext>;
}

/**
 * The first page's read comes from the server's render as `first`: while hydrating, the page is
 * drawn after what's around it.
 */
export function useBuddyPages(first: BuddyPageRead | null) {
  const pages = use(BuddyPagesContext);

  if (!pages) {
    throw new Error("The buddy's pages and its conversation must be inside BuddyPages");
  }

  if (first) {
    pages.keep(first);
  }

  return pages;
}

/** What a buddy page draws: nothing. A page that names no conversation (a blank one) keeps nothing. */
export function BuddyPage(page: BuddyPageRead) {
  useBuddyPages(page);
  return null;
}
