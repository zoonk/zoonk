import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadSessionProduce } from "../exams/essays/_utils/load-produce";
import { type WritingSupplyInput } from "../library/items/write-writing-item";
import { readBlockPayload } from "../sessions/block-payload";

export async function listWritingPreparation({
  goalId,
  timeZone,
  userId,
}: {
  goalId: string;
  timeZone: string;
  userId: string;
}): Promise<WritingSupplyInput[]> {
  const goal = await prisma.goal.findFirst({
    select: {
      examBlueprintId: true,
      kind: true,
      plan: { select: { settings: true } },
      targetDate: true,
    },
    where: { id: goalId, userId },
  });

  if (!goal?.plan) {
    return [];
  }

  const today = getDateInTimeZone({ date: new Date(), timeZone });

  const [produce, blocks] = await Promise.all([
    loadSessionProduce({ goal, planSettings: goal.plan.settings, today, userId }),
    prisma.studySessionBlock.findMany({
      select: { payload: true },
      where: { kind: "produce", session: { goalId, localDate: today, userId }, status: "pending" },
    }),
  ]);

  const requests = blocks.flatMap((block): WritingSupplyInput[] => {
    const { extra, skillIds, writing } = readBlockPayload(block);

    if (extra || !writing || writing.admissionId) {
      return [];
    }

    return [
      {
        count: 1,
        goalId,
        skillId: writing.unit === "drill" ? skillIds[0] : undefined,
        taskKey: writing.taskKey,
        unit: writing.unit,
        userId,
        wait: "later",
      },
    ];
  });

  if (
    produce &&
    !requests.some(
      (request) => request.taskKey === produce.taskKey && request.unit === produce.unit,
    )
  ) {
    requests.unshift({
      count: 1,
      goalId,
      taskKey: produce.taskKey,
      unit: produce.unit,
      userId,
      wait: "later",
    });
  }

  return requests;
}
