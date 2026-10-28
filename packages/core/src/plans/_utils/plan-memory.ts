import "server-only";
import { type Goal } from "@zoonk/db";
import { getMemoryForTask } from "../../memory/get-memory-for-task";

const PLAN_MEMORY_CATEGORIES = ["goals", "routine"] as const;

export async function loadPlanMemory({
  goal,
  need,
}: {
  goal: Pick<Goal, "id" | "language" | "userId">;
  need: string;
}): Promise<string[]> {
  const facts = await getMemoryForTask({
    analytics: { contentScope: "personal", distinctId: goal.userId, goalId: goal.id },
    categories: PLAN_MEMORY_CATEGORIES,
    language: goal.language,
    need,
    userId: goal.userId,
  });

  return facts.map((fact) => fact.statement);
}
