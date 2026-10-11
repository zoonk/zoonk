import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
} from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadUndoneTestOuts } from "./undone-test-outs";

describe(loadUndoneTestOuts, () => {
  // Undone, a class test's skipped organelles came back, and a plan short on time cut them first
  // again as known, ahead of cell theory the learner had missed.
  it("dates the skills of each undone test-out from the test-out, and no applied one's", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [plan, organelles, membrane, nucleus, unasked, lesson] = await Promise.all([
      planFixture({ goalId: goal.id }),
      skillFixture(),
      skillFixture(),
      skillFixture(),
      skillFixture(),
      libraryLessonFixture(),
    ]);

    // The undone item is a lesson: every skill it teaches counts, as far as the caller asks.
    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: membrane.id }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: unasked.id }),
    ]);

    const [undoneItem, appliedItem] = await Promise.all([
      planItemFixture({
        lessonId: lesson.id,
        planId: plan.id,
        position: 0,
        skillId: organelles.id,
      }),
      planItemFixture({ planId: plan.id, position: 1, skillId: nucleus.id, status: "testedOut" }),
    ]);

    const testedOutAt = new Date("2026-10-12T10:00:00Z");

    await Promise.all([
      planChangeFixture({
        createdAt: testedOutAt,
        kind: "testedOut",
        payload: { planItemIds: [undoneItem.id], source: "system" },
        planId: plan.id,
        status: "undone",
      }),
      planChangeFixture({
        kind: "testedOut",
        payload: { planItemIds: [appliedItem.id], source: "system" },
        planId: plan.id,
        status: "applied",
      }),
    ]);

    const events = await loadUndoneTestOuts({
      goalId: goal.id,
      skillIds: new Set([organelles.id, membrane.id, nucleus.id]),
    });

    expect(events).toStrictEqual(
      expect.arrayContaining([
        { at: testedOutAt, kind: "undone", skillId: organelles.id },
        { at: testedOutAt, kind: "undone", skillId: membrane.id },
      ]),
    );

    expect(events).toHaveLength(2);
  });
});
