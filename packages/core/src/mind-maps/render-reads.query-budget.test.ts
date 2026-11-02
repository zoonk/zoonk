import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { signedInCourseGoal } from "../view-models/_test-utils/course-goal";
import { getChapterMindMap } from "./get-chapter-mind-map";
import { listGoalMindMaps } from "./list-goal-mind-maps";

describe("mind map read budgets", () => {
  it.each(["list", "chapter"] as const)("keeps the read budget for %s", async (name) => {
    const { goal, chapters } = await signedInCourseGoal({
      statuses: ["done", "done", "todo", "todo"],
    });

    const counts = await countDatabaseStatements(async () =>
      name === "list"
        ? listGoalMindMaps({ goalId: goal.id })
        : getChapterMindMap({ chapterId: chapters[0]!.id, goalId: goal.id }),
    );

    assertReadBudget(counts, 37);
    expect(counts.result.status).toBe("ready");
  });
});
