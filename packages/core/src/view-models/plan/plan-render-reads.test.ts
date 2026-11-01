import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { type readSavedPlan } from "../../learner/facts/saved-plan";
import { signedInCourseGoal } from "../_test-utils/course-goal";
import { getProgressView } from "../progress/get-progress-view";
import { getPlanTabView } from "./get-plan-view";

// Vitest lacks Next's request cache: keep each read, as one request's private cache does.
vi.mock("../../learner/facts/saved-plan", async (importOriginal) => {
  const actual = await importOriginal<{ readSavedPlan: typeof readSavedPlan }>();
  const reads = new Map<string, ReturnType<typeof actual.readSavedPlan>>();

  return {
    ...actual,
    readSavedPlan: (userId: string, goalId: string) => {
      const key = `${userId}:${goalId}`;
      const read = reads.get(key) ?? actual.readSavedPlan(userId, goalId);
      reads.set(key, read);
      return read;
    },
  };
});

describe("the Plan's render reads", () => {
  it("reads the saved plan's items once for the plan and its progress", async () => {
    const { items } = await signedInCourseGoal();

    const reads = await countDatabaseRows(
      () => Promise.all([getPlanTabView(), getProgressView()]),
      '"plan_items"',
    );

    expect(reads.result.map((result) => result.status)).toStrictEqual(["ready", "ready"]);
    expect(reads.rows).toBe(items.length);
  });
});
