"use client";

import { usePathname } from "@/i18n/navigation";
import { getFromBrowser } from "@/lib/api/browser-api";
import {
  type BuddyConversations,
  type LessonQuestionResource,
  buddyConversationsSchema,
} from "@zoonk/core/lesson-questions/contract";
import { type BuddyConversation, type BuddyConversationList } from "@zoonk/learn/buddy";
import { safeAsync } from "@zoonk/utils/error";
import { useEffect, useState } from "react";

type OlderConversations = Pick<BuddyConversations, "conversations" | "nextCursor">;

type SavedQuestion = { conversationId: string; question: LessonQuestionResource };

const NAMED_CONVERSATION = /^\/buddy\/(?!new$|earlier-questions$)(?<id>[^/]+)$/u;

const NEW_CONVERSATION = "/buddy/new";

const BLANK_PAGE = /\/buddy(?:\/new)?\/?$/u;

const CONVERSATION_PAGE = /\/buddy\/[^/]+\/?$/u;

async function readOlder({
  cursor,
  goalId,
}: {
  cursor: string;
  goalId: string;
}): Promise<OlderConversations | null> {
  const response = await getFromBrowser(
    `/v1/goals/${encodeURIComponent(goalId)}/buddy/conversations?cursor=${encodeURIComponent(cursor)}`,
  );

  if (!response?.ok) {
    return null;
  }

  const { data } = await safeAsync(async () =>
    buddyConversationsSchema.parse(await response.json()),
  );

  return data ?? null;
}

/** A conversation asked in here comes first; the rest keep the order they were read in. */
function listConversations({
  asked,
  read,
}: {
  asked: readonly BuddyConversation[];
  read: readonly BuddyConversation[];
}): BuddyConversation[] {
  const titles = new Map(read.map(({ id, title }) => [id, title]));
  const askedIds = new Set(asked.map(({ id }) => id));

  return [
    ...asked.map((conversation) => ({
      ...conversation,
      title: titles.get(conversation.id) ?? conversation.title,
    })),
    ...read.filter(({ id }) => !askedIds.has(id)),
  ];
}

/** The address changes in place: the page isn't read again, so the answer on its way keeps coming. */
function nameConversationInUrl(conversationId: string) {
  const { pathname } = globalThis.location;

  globalThis.history.replaceState(
    null,
    "",
    pathname.replace(BLANK_PAGE, `/buddy/${conversationId}`),
  );
}

/** The conversation the URL names, unless it's another goal's: that URL becomes `/buddy`. */
function useNamedConversation({
  isOfAnotherGoal,
  pathname,
}: {
  isOfAnotherGoal: (conversationId: string) => boolean;
  pathname: string;
}): string | null {
  const address = NAMED_CONVERSATION.exec(pathname)?.groups?.id ?? null;
  const misplaced = address !== null && isOfAnotherGoal(address);

  useEffect(() => {
    if (misplaced) {
      const path = globalThis.location.pathname.replace(CONVERSATION_PAGE, "/buddy");
      globalThis.history.replaceState(null, "", path);
    }
  }, [misplaced]);

  return misplaced ? null : address;
}

/**
 * Which conversation is open, and the goal's list of them.
 *
 * The URL says which is open. `/buddy` opens the one the learner asked in today, as the server read
 * it or as asked here since (`readAt` tells which is newer), and a blank one otherwise, as
 * `/buddy/new` always does. A blank one's id is made here: its first question creates it under that
 * id, and the URL then names it. A URL that names another goal's conversation opens what `/buddy`
 * does, and becomes `/buddy`.
 *
 * The list is what the page read, the older ones "Show more" brought, and the ones asked in since.
 */
export function useBuddyConversations({
  goalId,
  isOfAnotherGoal,
  read,
  readAt,
}: {
  goalId: string;
  isOfAnotherGoal: (conversationId: string) => boolean;
  /** Null for a guest, who can't ask and so has none. */
  read: BuddyConversations | null;
  readAt: number;
}) {
  const pathname = usePathname();
  const [blankId, setBlankId] = useState(() => crypto.randomUUID());
  const [older, setOlder] = useState<OlderConversations | null>(null);
  const [asked, setAsked] = useState<readonly BuddyConversation[]>([]);
  const [request, setRequest] = useState<"busy" | "failed" | "idle">("idle");

  const named = useNamedConversation({ isOfAnotherGoal, pathname });
  const startAnother = () => setBlankId(crypto.randomUUID());

  // The blank one was sent and the URL names it now, so the next blank page starts another.
  if (named === blankId) {
    startAnother();
  }

  const latest = asked[0];
  const askedSinceRead = latest && Date.parse(latest.lastAskedAt) > readAt;
  const currentId = askedSinceRead ? latest.id : (read?.currentId ?? null);
  const openId = named ?? (pathname === NEW_CONVERSATION ? null : currentId);

  const open = openId ? { blank: false, id: openId } : { blank: true, id: blankId };

  const questionSaved = ({ conversationId, question }: SavedQuestion) => {
    setAsked((current) => [
      {
        id: conversationId,
        lastAskedAt: question.createdAt,
        title:
          current.find(({ id }) => id === conversationId)?.title ??
          question.question.trim().replaceAll(/\s+/gu, " "),
      },
      ...current.filter(({ id }) => id !== conversationId),
    ]);

    if (conversationId !== blankId) {
      return;
    }

    // A blank one the learner already left has no page to rename, only its id to retire.
    if (named === null) {
      nameConversationInUrl(conversationId);
    } else {
      startAnother();
    }
  };

  if (!read) {
    return { list: null, open, questionSaved };
  }

  const cursor = older ? older.nextCursor : read.nextCursor;

  const conversations = listConversations({
    asked,
    read: [...read.conversations, ...(older?.conversations ?? [])],
  });

  const showMore = async (from: string) => {
    setRequest("busy");
    const page = await readOlder({ cursor: from, goalId });

    if (page) {
      setOlder((current) => ({
        conversations: [...(current?.conversations ?? []), ...page.conversations],
        nextCursor: page.nextCursor,
      }));
    }

    setRequest(page ? "idle" : "failed");
  };

  const list: BuddyConversationList = {
    conversationHref: (id) => `/buddy/${id}`,
    conversations,
    more: cursor
      ? {
          busy: request === "busy",
          failed: request === "failed",
          show: () => void showMore(cursor),
        }
      : null,
    newHref: NEW_CONVERSATION,
    // A conversation is listed the moment it's saved, a beat before the address names it.
    openId: open.blank && !conversations.some(({ id }) => id === open.id) ? null : open.id,
  };

  return { list, open, questionSaved };
}
