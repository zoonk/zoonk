import { MS_PER_DAY } from "@zoonk/utils/date";
import { connection } from "next/server";

/** The start of a spend period of `days` days ending now, read per request, never prerendered. */
export async function getAiSpendSince(days: number): Promise<Date> {
  await connection();
  return new Date(Date.now() - days * MS_PER_DAY);
}

/** The start of this month in UTC, as usage limits count months, read per request. */
export async function getAiSpendMonthStart(): Promise<Date> {
  await connection();
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
