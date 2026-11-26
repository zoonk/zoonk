import "server-only";
import { prisma, sql } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getBuddyConversationsCacheTag } from "../cache/tags";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { readOwnedGoal } from "../learner/facts/owned-goal";
import { getRequestInstant } from "../learner/facts/request-instant";
import { getSession } from "../users/get-session";
import { type BuddyConversations } from "./contract";

const PAGE_SIZE = 30;

type ConversationScope = { goalId: string; userId: string };
type ConversationCursor = { id: string; updatedAt: Date };
type ConversationRow = { id: string; lastAskedAt: Date; title: string };

type ListBuddyConversationsResult =
  | ({ status: "ready" } & BuddyConversations)
  | { status: "invalidCursor" | "notFound" | "unauthorized" };

function findCursor({ cursor, goalId, userId }: ConversationScope & { cursor: string }) {
  if (!isUuid(cursor)) {
    return null;
  }

  return prisma.lessonQuestionThread.findFirst({
    select: { id: true, updatedAt: true },
    where: { goalId, id: cursor, kind: "plan", questions: { some: {} }, userId },
  });
}

function readConversations({
  from,
  goalId,
  take,
  userId,
}: ConversationScope & { from?: ConversationCursor; take: number }) {
  const older = from
    ? sql`AND (thread.updated_at, thread.id) < (${from.updatedAt}, ${from.id}::uuid)`
    : sql``;

  return prisma.$queryRaw<ConversationRow[]>`
    WITH page AS (
      SELECT thread.id, thread.updated_at
      FROM lesson_question_threads AS thread
      WHERE thread.user_id = ${userId}::uuid AND thread.goal_id = ${goalId}::uuid AND thread.kind = 'plan'
        ${older}
        AND EXISTS (SELECT 1 FROM lesson_questions WHERE thread_id = thread.id)
      ORDER BY thread.updated_at DESC, thread.id DESC
      LIMIT ${take}
    )
    SELECT page.id, first_question.question AS title, last_question.created_at AS "lastAskedAt"
    FROM page
    CROSS JOIN LATERAL (
      SELECT question FROM lesson_questions
      WHERE thread_id = page.id
      ORDER BY created_at, id LIMIT 1
    ) AS first_question
    CROSS JOIN LATERAL (
      SELECT created_at FROM lesson_questions
      WHERE thread_id = page.id
      ORDER BY created_at DESC LIMIT 1
    ) AS last_question
    ORDER BY page.updated_at DESC, page.id DESC
  `;
}

/** Returns the current conversation across all pages, including when reading an older page. */
export async function listBuddyConversations({
  cursor,
  goalId,
}: {
  cursor?: string;
  goalId: string;
}): Promise<ListBuddyConversationsResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const goal = isUuid(goalId) ? await readOwnedGoal(userId, goalId) : null;

  if (!goal) {
    return { status: "notFound" };
  }

  cacheTag(getBuddyConversationsCacheTag(userId, goal.id));

  const scope = { goalId: goal.id, userId };
  const from = cursor === undefined ? undefined : await findCursor({ ...scope, cursor });

  if (from === null) {
    return { status: "invalidCursor" };
  }

  const [rows, latest, now] = await Promise.all([
    readConversations({ ...scope, from, take: PAGE_SIZE + 1 }),
    from ? readConversations({ ...scope, take: 1 }) : undefined,
    getRequestInstant(),
  ]);

  const newest = (latest ?? rows)[0];
  const timeZone = getAnswerTimeZone({ goal });
  const today = getDateInTimeZone({ date: now, timeZone });

  const currentId =
    newest &&
    getDateInTimeZone({ date: newest.lastAskedAt, timeZone }).getTime() === today.getTime()
      ? newest.id
      : null;

  const page = rows.slice(0, PAGE_SIZE);

  return {
    conversations: page.map(({ id, lastAskedAt, title }) => ({
      id,
      lastAskedAt: lastAskedAt.toISOString(),
      title: title.trim().replaceAll(/\s+/gu, " "),
    })),
    currentId,
    nextCursor: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    status: "ready",
  };
}
