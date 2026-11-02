import { MS_PER_DAY } from "@zoonk/utils/date";
import { connection } from "next/server";

export async function getAiSpendSince(days: number): Promise<Date> {
  await connection();
  return new Date(Date.now() - days * MS_PER_DAY);
}

export async function getAiSpendMonthStart(): Promise<Date> {
  await connection();
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
