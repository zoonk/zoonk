import "server-only";
import { type Goal } from "@zoonk/db";
import { getMemoryForTask } from "../../memory/get-memory-for-task";

/** The planner reads what the learner told the app about their goals and routine, nothing else. */
const PLAN_MEMORY_CATEGORIES = ["goals", "routine"] as const;

/**
 * What memory holds about the learner's goals and routine for one planning task, as statements.
 * Memory off, a minor's limits and sensitive facts are handled by `getMemoryForTask`.
 */
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
