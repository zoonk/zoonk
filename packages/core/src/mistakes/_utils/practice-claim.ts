import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { openVisibleMistakeWhere } from "./visible-mistake";

export function readPracticeMistakeId(answer: unknown): string | null {
  return isJsonObject(answer) && typeof answer.practiceMistakeId === "string"
    ? answer.practiceMistakeId
    : null;
}

/** Caller holds the learner lock. A distinct submission can get a verdict even if credit was used. */
export async function hasPracticeCredit({
  answeredAt,
  mistakeId,
  timeZone,
  transaction,
  userId,
}: {
  answeredAt: Date;
  mistakeId: string;
  timeZone: string;
  transaction: TransactionClient;
  userId: string;
}): Promise<boolean> {
  const localDate = getDateInTimeZone({ date: answeredAt, timeZone });

  const counted = await transaction.attempt.findFirst({
    select: { id: true },
    where: {
      answer: { equals: mistakeId, path: ["practiceMistakeId"] },
      answeredAt: { gte: getStartOfLocalDay({ localDate, timeZone }) },
      studySessionId: null,
      userId,
    },
  });

  return counted === null;
}

/** An intervening fix closes the entry to new submissions, even when grading began earlier. */
export function refuseClosedMistake({ mistakeId, userId }: { mistakeId: string; userId: string }) {
  return async function refuse(transaction: TransactionClient): Promise<"closed" | null> {
    const open = await transaction.mistake.findFirst({
      select: { id: true },
      where: { ...openVisibleMistakeWhere, id: mistakeId, userId },
    });

    return open ? null : "closed";
  };
}
