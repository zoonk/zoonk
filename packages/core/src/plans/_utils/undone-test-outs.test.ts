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
import { loadClaimEvents } from "../../learner/_utils/load-skill-claims";

describe("undone test-outs in claim events", () => {
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

    const claims = await loadClaimEvents({
      goalId: goal.id,
      skillIds: [organelles.id, membrane.id, nucleus.id],
      userId: user.id,
    });

    const events = claims.filter((event) => event.kind === "undone");

    expect(events).toStrictEqual(
      expect.arrayContaining([
        { at: testedOutAt, kind: "undone", skillId: organelles.id },
        { at: testedOutAt, kind: "undone", skillId: membrane.id },
      ]),
    );

    expect(events).toHaveLength(2);
  });
});
