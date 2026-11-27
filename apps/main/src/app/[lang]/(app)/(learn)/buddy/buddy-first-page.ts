import "server-only";
import { type LessonQuestionThreadResource } from "@zoonk/core/lesson-questions/contract";
import { cache } from "react";

export type BuddyPageRead = {
  conversationId?: string;
  /** The learner's own conversation, of a goal that isn't the active one. */
  ofAnotherGoal?: boolean;
  thread?: Pick<LessonQuestionThreadResource, "hasMore" | "nextCursor" | "questions"> | null;
};

const getChannel = cache(() => ({ ...Promise.withResolvers<BuddyPageRead>(), hasPage: false }));

/**
 * The layout draws the conversation, and only the page knows which one its URL names. Both are
 * drawn in one server render, so the page hands what it read to the layout here: the conversation
 * then starts with it, in the server's HTML and as the browser hydrates. The page says it's coming
 * before its first read, and always hands over, so the layout never waits for nothing.
 */
export async function handOverBuddyPage(read: () => Promise<BuddyPageRead>) {
  const channel = getChannel();
  channel.hasPage = true;

  try {
    const page = await read();
    channel.resolve(page);
    return page;
  } catch (error) {
    channel.resolve({});
    throw error;
  }
}

/** Null when the layout is drawn without a page that hands over, such as one that only redirects. */
export function readFirstBuddyPage(): Promise<BuddyPageRead | null> {
  const channel = getChannel();
  return channel.hasPage ? channel.promise : Promise.resolve(null);
}
