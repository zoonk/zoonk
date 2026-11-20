import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { readWritingExtraLimit } from "../../exams/essays/writing-admission";
import { fromIsoDate } from "../../plans/planner/plan-calendar";

export async function readExtraWritingLimit(userId: string, date: string) {
  "use cache: private";

  cacheTag(getLearnerModelCacheTag(userId));

  return readWritingExtraLimit({ localDate: fromIsoDate(date), tx: prisma, userId });
}
