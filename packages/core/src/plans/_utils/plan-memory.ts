import "server-only";
import { type Goal } from "@zoonk/db";
import {
  type MemoryFactForTask,
  getMemoryForTask,
  selectMemoryForTask,
} from "../../memory/get-memory-for-task";

const PLAN_MEMORY_CATEGORIES = ["goals", "routine"] as const;

type PlanMemoryRequest = { goal: Pick<Goal, "id" | "userId">; need: string };

function toTaskRequest({ goal, need }: PlanMemoryRequest) {
  return {
    analytics: { contentScope: "personal" as const, distinctId: goal.userId, goalId: goal.id },
    categories: PLAN_MEMORY_CATEGORIES,
    need,
    userId: goal.userId,
  };
}

function toStatements(facts: readonly MemoryFactForTask[]): string[] {
  return facts.map((fact) => fact.statement);
}

export async function loadPlanMemory(request: PlanMemoryRequest): Promise<string[]> {
  return toStatements(await getMemoryForTask(toTaskRequest(request)));
}

/** For a workflow step: a failed relevance check throws so the step retries. */
export async function selectPlanMemory(request: PlanMemoryRequest): Promise<string[]> {
  return toStatements(await selectMemoryForTask(toTaskRequest(request)));
}
