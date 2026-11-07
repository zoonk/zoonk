import "server-only";
import {
  type Item,
  type StudySession,
  type StudySessionBlock,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { getBlockItemIds, readBlockPayload } from "../block-payload";

/** Reads project the filtered block; Start persists it under the learner and block locks. */
export async function withoutReviewedSkills({
  answeredItemIds,
  block,
  items,
  now,
  session,
  timeZone,
  tx = prisma,
}: {
  answeredItemIds?: ReadonlySet<string | null>;
  block: StudySessionBlock;
  items?: readonly Pick<Item, "id" | "skillId">[];
  now: Date;
  session: Pick<StudySession, "goalId" | "id" | "userId">;
  timeZone: string;
  tx?: TransactionClient;
}): Promise<StudySessionBlock> {
  if (block.kind !== "review" || (block.status !== "pending" && block.status !== "active")) {
    return block;
  }

  const payload = readBlockPayload(block);
  const skillIds = [...new Set(payload.capsules.flatMap((capsule) => capsule.skillIds))];

  if (skillIds.length === 0) {
    return block;
  }

  const today = getDateInTimeZone({ date: now, timeZone });

  const [answers, questions] = await Promise.all([
    tx.attempt.findMany({
      select: { itemId: true, skillId: true, studySessionId: true },
      where: {
        OR: [
          ...(answeredItemIds ? [] : [{ studySessionId: session.id }]),
          {
            answeredAt: {
              gte: getStartOfLocalDay({ localDate: today, timeZone }),
              lt: getStartOfLocalDay({
                localDate: new Date(today.getTime() + MS_PER_DAY),
                timeZone,
              }),
            },
            studySession: { goalId: { not: session.goalId } },
          },
        ],
        skillId: { in: skillIds },
        userId: session.userId,
      },
    }),
    items ??
      tx.item.findMany({
        select: { id: true, skillId: true },
        where: { id: { in: payload.capsules.flatMap((capsule) => capsule.itemIds) } },
      }),
  ]);

  const reviewed = new Set(
    answers
      .filter((answer) => answer.studySessionId !== session.id)
      .map((answer) => answer.skillId),
  );

  if (reviewed.size === 0) {
    return block;
  }

  const answeredHere =
    answeredItemIds ??
    new Set(
      answers
        .filter((answer) => answer.studySessionId === session.id)
        .map((answer) => answer.itemId),
    );

  const removed = new Set(
    questions
      .filter((item) => reviewed.has(item.skillId) && !answeredHere.has(item.id))
      .map((item) => item.id),
  );

  if (removed.size === 0) {
    return block;
  }

  const capsules = payload.capsules
    .map((capsule) => ({
      ...capsule,
      itemIds: capsule.itemIds.filter((id) => !removed.has(id)),
      skillIds: capsule.skillIds.filter(
        (id) =>
          !reviewed.has(id) ||
          questions.some((item) => item.skillId === id && answeredHere.has(item.id)),
      ),
    }))
    .filter((capsule) => capsule.itemIds.length > 0);

  const next = { ...payload, capsules };

  return {
    ...block,
    payload: {
      ...next,
      skillIds: [
        ...new Set([
          ...payload.skillIds.filter((id) => !reviewed.has(id)),
          ...capsules.flatMap((capsule) => capsule.skillIds),
        ]),
      ],
    },
    status: getBlockItemIds(next).length === 0 ? "skipped" : block.status,
  };
}
