import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isCurrentSession } from "./current-session";
import { STUDY_SESSION_INCLUDE } from "./study-session-access";

/** Replayed completions must use the persisted block id, never another block opened for the same lesson meanwhile. */
export async function findDayLessonBlock({
  blockId,
  client = prisma,
  lessonId,
  now = new Date(),
  runStartedAt,
  timeZone,
  userId,
}: {
  blockId?: string;
  client?: Pick<TransactionClient, "studySessionBlock">;
  lessonId: string;
  now?: Date;
  /** Exclude blocks completed before this run began. */
  runStartedAt?: Date;
  timeZone: string;
  userId: string;
}) {
  const today = getDateInTimeZone({ date: now, timeZone });

  const blocks = await client.studySessionBlock.findMany({
    include: { session: { include: STUDY_SESSION_INCLUDE } },
    orderBy: [{ completedAt: { nulls: "first", sort: "desc" } }, { position: "asc" }],
    where: {
      ...(blockId && { id: blockId }),
      kind: "learn",
      lessonId,
      session: {
        ...(!blockId && { localDate: { in: [today, new Date(today.getTime() - MS_PER_DAY)] } }),
        userId,
      },
      status: { in: ["active", "pending", "completed"] },
      ...(runStartedAt && { OR: [{ completedAt: null }, { completedAt: { gte: runStartedAt } }] }),
    },
  });

  const current = blockId
    ? blocks
    : blocks.filter((block) => isCurrentSession({ now, session: block.session, timeZone }));

  return current.find((block) => block.status === "active") ?? current[0] ?? null;
}
