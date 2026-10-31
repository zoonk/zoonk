import "server-only";
import { type Goal } from "@zoonk/db";
import {
  type MemoryFactForTask,
  getMemoryForTask,
  selectMemoryFacts,
  startMemorySearch,
} from "../../memory/get-memory-for-task";

const PLAN_MEMORY_CATEGORIES = ["goals", "routine"] as const;

type PlanMemoryRequest = { goal: Pick<Goal, "id" | "language" | "userId">; need: string };

export type PlanMemorySearch = { memory: string[] } | { terms: string[] };

function toTaskRequest({ goal, need }: PlanMemoryRequest) {
  return {
    analytics: { contentScope: "personal" as const, distinctId: goal.userId, goalId: goal.id },
    categories: PLAN_MEMORY_CATEGORIES,
    language: goal.language,
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

export async function searchPlanMemory(request: PlanMemoryRequest): Promise<PlanMemorySearch> {
  const search = await startMemorySearch(toTaskRequest(request));
  return "terms" in search ? search : { memory: toStatements(search.facts) };
}

export async function selectPlanMemory({
  terms,
  ...request
}: PlanMemoryRequest & { terms: string[] }): Promise<string[]> {
  return toStatements(await selectMemoryFacts({ ...toTaskRequest(request), terms }));
}
