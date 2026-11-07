import { uuidSchema } from "@zoonk/utils/uuid-schema";

/**
 * Today shows a reminder's goal through `?goal=` without making it the active one, and its links
 * pass the goal on, so the pages they open show that goal too. Each page reads it through core,
 * which admits only the learner's own goals.
 */
export function readGoalParam(query: { goal?: string | string[] }): string | undefined {
  return uuidSchema().safeParse(query.goal).data;
}

export function withGoal(href: string, goalId?: string): string {
  return goalId ? `${href}${href.includes("?") ? "&" : "?"}goal=${goalId}` : href;
}
