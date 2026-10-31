import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadPracticeItems } from "./_utils/load-practice";

describe(loadPracticeItems, () => {
  it("keeps the caller's skill order when studied skills have the same recall risk", async () => {
    const user = await userFixture();
    const now = new Date("2026-10-18T12:00:00Z");
    const skills = await Promise.all([skillFixture(), skillFixture(), skillFixture()]);
    const questions = await Promise.all(skills.map((skill) => itemFixture({ skillId: skill.id })));

    await Promise.all(
      skills.map((skill) =>
        learnerSkillFixture({
          difficulty: 5,
          lastReviewedAt: new Date("2026-10-14T12:00:00Z"),
          reps: 3,
          skillId: skill.id,
          stability: 10,
          userId: user.id,
        }),
      ),
    );

    const load = (skillIds: string[]) =>
      loadPracticeItems({
        difficultyBias: "standard",
        examBlueprintId: null,
        excludeItemIds: new Set(),
        field: null,
        now,
        skillIds,
        typed: false,
        userId: user.id,
      });

    const [forward, reversed] = await Promise.all([
      load(skills.map((skill) => skill.id)),
      load(skills.toReversed().map((skill) => skill.id)),
    ]);

    expect(forward.map((item) => item.itemId)).toStrictEqual(questions.map((item) => item.id));

    expect(reversed.map((item) => item.itemId)).toStrictEqual(
      questions.toReversed().map((item) => item.id),
    );
  });
});
