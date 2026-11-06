import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isCurrentSession, isRunStartDay } from "./current-session";
import { STUDY_SESSION_INCLUDE } from "./study-session-access";

/** A block completed before the run began belongs to an earlier play of the lesson. */
export async function findDayLessonBlock({
  client,
  lessonId,
  now,
  runStartedAt,
  timeZone,
  userId,
}: {
  client: Pick<TransactionClient, "studySessionBlock">;
  lessonId: string;
  now: Date;
  runStartedAt: Date;
  timeZone: string;
  userId: string;
}) {
  const today = getDateInTimeZone({ date: now, timeZone });

  const blocks = await client.studySessionBlock.findMany({
    include: { session: { include: STUDY_SESSION_INCLUDE } },
    orderBy: [{ completedAt: { nulls: "first", sort: "desc" } }, { position: "asc" }],
    where: {
      OR: [{ completedAt: null }, { completedAt: { gte: runStartedAt } }],
      kind: "learn",
      lessonId,
      session: { localDate: { in: [today, new Date(today.getTime() - MS_PER_DAY)] }, userId },
      status: { in: ["active", "pending", "completed"] },
    },
  });

  const current = blocks.filter(
    ({ session }) =>
      isCurrentSession({ now, session, timeZone }) ||
      isRunStartDay({ now, runStartedAt, session, timeZone }),
  );

  return current.find((block) => block.status === "active") ?? current[0] ?? null;
}
