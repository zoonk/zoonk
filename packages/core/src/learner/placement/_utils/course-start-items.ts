import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { type GoalPlan } from "../../_utils/goal-skill-graph";

export async function applyCourseStart({
  goalId,
  now,
  plan,
  startedPastSkillIds,
  tx,
}: {
  goalId: string;
  now: Date;
  plan: GoalPlan;
  startedPastSkillIds: readonly string[];
  tx: TransactionClient;
}) {
  const skipped = new Set(startedPastSkillIds);
  const ids = plan.items
    .filter(
      (item) =>
        item.status === "todo" &&
        item.skillIds.length > 0 &&
        item.skillIds.every((id) => skipped.has(id)),
    )
    .map((item) => item.id);
  const items = ids.length
    ? await tx.planItem.updateManyAndReturn({
        data: { status: "testedOut", completedAt: now },
        where: { id: { in: ids }, plan: { goalId }, kind: "lesson", status: "todo" },
        select: {
          id: true,
          chapterId: true,
          kind: true,
          lessonId: true,
          lessons: true,
          skillId: true,
        },
      })
    : [];
  return {
    confirmed: new Set<string>(),
    heldUntilTomorrow: false,
    partLessonsSkipped: countLessons(items),
    sharedItemIds: [],
    testedOutPlanItemIds: items.map((item) => item.id),
  };
}
