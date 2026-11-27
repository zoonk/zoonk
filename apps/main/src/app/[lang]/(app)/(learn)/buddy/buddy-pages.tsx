"use client";

import { type LessonQuestionThreadResource } from "@zoonk/core/lesson-questions/contract";
import { createContext, use, useState } from "react";

type ThreadPage = Pick<LessonQuestionThreadResource, "hasMore" | "nextCursor" | "questions">;

type PageRead = {
  conversationId?: string;
  /** The learner's own conversation, of a goal that isn't the active one. */
  ofAnotherGoal?: boolean;
  thread?: ThreadPage | null;
};

function createBuddyPages() {
  const read = new Map<string, ThreadPage>();
  const ofAnotherGoal = new Set<string>();
  const firstPage = Promise.withResolvers<null>();
  let hasPage = false;

  return {
    /** Settles once a page has said what it read, so the conversation starts with it. */
    firstPage: firstPage.promise,
    hasPage: () => hasPage,
    isOfAnotherGoal: (conversationId: string) => ofAnotherGoal.has(conversationId),
    keep: (page: PageRead) => {
      if (page.conversationId && page.thread) {
        read.set(page.conversationId, page.thread);
      }

      if (page.conversationId && page.ofAnotherGoal) {
        ofAnotherGoal.add(page.conversationId);
      } else if (page.conversationId) {
        ofAnotherGoal.delete(page.conversationId);
      }

      hasPage = true;
      firstPage.resolve(null);
    },
    /** Null for a conversation no page read, which then loads itself. */
    readOf: (conversationId: string) => read.get(conversationId) ?? null,
  };
}

const BuddyPagesContext = createContext<ReturnType<typeof createBuddyPages> | null>(null);

function useBuddyPagesChannel() {
  const pages = use(BuddyPagesContext);

  if (!pages) {
    throw new Error("The buddy's pages and its conversation must be inside BuddyPages");
  }

  return pages;
}

/**
 * The buddy's layout draws the conversation, and the page under it only knows which one its URL
 * names. The page is drawn first and says here what it read of that one, so the conversation has it
 * in the same server render and from the first paint.
 */
export function BuddyPages({ children }: { children: React.ReactNode }) {
  // oxlint-disable-next-line react/hook-use-state -- Made once and never replaced, so there is no setter.
  const [pages] = useState(createBuddyPages);
  return <BuddyPagesContext value={pages}>{children}</BuddyPagesContext>;
}

/**
 * What a buddy page draws: nothing. It hands over the conversation its URL names as the server
 * read it, while rendering, as the page is drawn before the conversation. A page that names none
 * (a blank one) hands over nothing.
 */
export function BuddyPage(page: PageRead) {
  useBuddyPagesChannel().keep(page);
  return null;
}

/**
 * What the pages handed over. It waits for the first page inside a `Suspense` of its own: while
 * hydrating, the page is drawn after what's around it.
 */
export function useBuddyPages() {
  const pages = useBuddyPagesChannel();

  if (!pages.hasPage()) {
    use(pages.firstPage);
  }

  return pages;
}
