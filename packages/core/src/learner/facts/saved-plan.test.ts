import { describe, expect, it } from "vitest";
import { signedInCourseGoal } from "../../view-models/_test-utils/course-goal";
import { readSavedPlan } from "./saved-plan";

describe(readSavedPlan, () => {
  it("leaves out the item columns no reader uses, since each reader decodes the whole cached plan", async () => {
    const { goal, items, user } = await signedInCourseGoal();
    const saved = await readSavedPlan(user.id, goal.id);
    const columns = new Set(saved?.items.flatMap((item) => Object.keys(item)));
    const unused = ["createdAt", "planId", "updatedAt"].filter((key) => columns.has(key));

    expect(saved?.items.map((item) => item.id)).toStrictEqual(items.map((item) => item.id));
    expect(unused).toStrictEqual([]);
  });
});
