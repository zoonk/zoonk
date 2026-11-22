import "server-only";
import { AnyNull, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../../cache/tags";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { readBlockPayload } from "../../sessions/block-payload";

export async function loadScheduledAnswers(userId: string, goalId: string) {
  const blocks = await prisma.studySessionBlock.findMany({
    select: {
      estimatedMinutes: true,
      payload: true,
      session: { select: { localDate: true } },
      status: true,
    },
    where: {
      AND: [
        { payload: { equals: false, path: ["extra"] } },
        { payload: { equals: "answer", path: ["writing", "unit"] } },
        { payload: { not: AnyNull, path: ["writing", "admissionId"] } },
      ],
      kind: "produce",
      session: { goalId, userId },
      status: { in: ["active", "completed"] },
    },
  });

  return blocks.flatMap((block) => {
    const { writing, writingPlacement } = readBlockPayload(block);

    return writing?.admissionId
      ? [
          {
            completed: block.status === "completed",
            date: toIsoDate(block.session.localDate),
            minutes: block.estimatedMinutes ?? 0,
            placement: Boolean(writingPlacement),
            taskKey: writing.taskKey,
          },
        ]
      : [];
  });
}

export async function readScheduledAnswers(userId: string, goalId: string) {
  "use cache: private";

  cacheTag(getLearnerModelCacheTag(userId), getUserProgressCacheTag(userId));

  return loadScheduledAnswers(userId, goalId);
}
