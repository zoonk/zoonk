"use client";

import { type LessonQuestionThreadResource } from "@zoonk/core/lesson-questions/contract";
import { createContext, use, useState } from "react";

type ThreadPage = Pick<LessonQuestionThreadResource, "hasMore" | "nextCursor" | "questions">;

const NOTHING_ASKED: ThreadPage = { hasMore: false, nextCursor: null, questions: [] };

function createBuddyThreads() {
  const read = new Map<string, ThreadPage>();
  const firstPage = Promise.withResolvers<null>();
  let hasPage = false;

  return {
    /** Settles once a page has said what it read, so the conversation starts with it. */
    firstPage: firstPage.promise,
    hasPage: () => hasPage,
    keep: ({ conversationId, thread }: { conversationId?: string; thread?: ThreadPage | null }) => {
      if (conversationId && thread) {
        read.set(conversationId, thread);
      }

      hasPage = true;
      firstPage.resolve(null);
    },
    readOf: (conversationId: string) => read.get(conversationId) ?? null,
  };
}

const BuddyThreadsContext = createContext<ReturnType<typeof createBuddyThreads> | null>(null);

function useBuddyThreads() {
  const threads = use(BuddyThreadsContext);

  if (!threads) {
    throw new Error("The buddy's pages and its conversation must be inside BuddyThreads");
  }

  return threads;
}

/**
 * The buddy's layout draws the conversation, and the page under it only knows which one its URL
 * names. The page is drawn first and says here what it read of that one, so the conversation has it
 * in the same server render and from the first paint.
 */
export function BuddyThreads({ children }: { children: React.ReactNode }) {
  // oxlint-disable-next-line react/hook-use-state -- Made once and never replaced, so there is no setter.
  const [threads] = useState(createBuddyThreads);
  return <BuddyThreadsContext value={threads}>{children}</BuddyThreadsContext>;
}

/**
 * What a buddy page draws: nothing. It hands over the conversation its URL names as the server
 * read it, while rendering, as the page is drawn before the conversation. A page that names none
 * (a blank one) hands over nothing.
 */
export function ProvideBuddyThread(page: { conversationId?: string; thread?: ThreadPage | null }) {
  useBuddyThreads().keep(page);
  return null;
}

/**
 * Null for a conversation no page read, which then loads itself. It waits for the first page inside
 * a `Suspense` of its own: while hydrating, the page is drawn after what's around it.
 */
export function useBuddyThread(open: { blank: boolean; id: string }): ThreadPage | null {
  const threads = useBuddyThreads();

  if (!threads.hasPage()) {
    use(threads.firstPage);
  }

  return open.blank ? NOTHING_ASKED : threads.readOf(open.id);
}
