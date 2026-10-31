import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { WEEKLY_CHALLENGE_KINDS } from "../../../checkpoints/_utils/load-weekly-challenge";
import { loadMockCard } from "../../../checkpoints/_utils/mock-card";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { type ExamNextMock } from "../exam-view-contract";

export async function loadNextMock({
  blueprint,
  goal,
  today,
}: {
  blueprint: ExamBlueprint | null;
  goal: Goal;
  today: Date;
}): Promise<ExamNextMock | null> {
  const item = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    where: {
      OR: [{ scheduledFor: null }, { scheduledFor: { gte: today } }],
      kind: { in: [...WEEKLY_CHALLENGE_KINDS] },
      plan: { goalId: goal.id },
      status: "todo",
    },
  });

  if (item?.kind !== "mock") {
    return null;
  }

  const card = await loadMockCard({ blueprint, date: item.scheduledFor ?? today, goal, today });

  return {
    date: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
    fullLength: card.conditions.fullLength,
    planItemId: item.id,
    questions: card.conditions.questions,
  };
}
