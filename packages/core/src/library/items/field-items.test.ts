import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  FIELD_ITEMS_PER_SKILL,
  listGoalFieldItemTargets,
  listLessonFieldItemTargets,
} from "./field-items";

function planSkill({ phase, skillId }: { phase: number; skillId: string }) {
  return { area: null, lessons: 1, name: "Skill", phase, skillId, weight: null };
}

describe(listGoalFieldItemTargets, () => {
  it("lists the first phase's skills that don't have the field's questions yet", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });

    const [covered, needed, later, otherField] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    await Promise.all([
      planFixture({
        goalId: goal.id,
        graph: {
          skills: [
            planSkill({ phase: 0, skillId: covered.id }),
            planSkill({ phase: 0, skillId: needed.id }),
            planSkill({ phase: 0, skillId: otherField.id }),
            planSkill({ phase: 1, skillId: later.id }),
          ],
        },
      }),
      ...Array.from({ length: FIELD_ITEMS_PER_SKILL }, () =>
        itemFixture({ field: "nursing", skillId: covered.id }),
      ),
      itemFixture({ field: "law", skillId: otherField.id }),
    ]);

    const targets = await listGoalFieldItemTargets({ field: "nursing", goalId: goal.id });

    expect(targets.map((target) => target.skill.id)).toStrictEqual([needed.id, otherField.id]);
    expect(targets.every((target) => target.field === "nursing")).toBe(true);
  });
});

describe(listLessonFieldItemTargets, () => {
  it("lists the skills of the next lessons, in lesson order, leaving out language skills", async () => {
    const [first, second] = await Promise.all([libraryLessonFixture(), libraryLessonFixture()]);

    const [firstSkill, secondSkill, wordSkill] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture({ targetLanguage: "es" }),
    ]);

    await Promise.all([
      lessonSkillFixture({ lessonId: second.id, skillId: secondSkill.id }),
      lessonSkillFixture({ lessonId: first.id, skillId: firstSkill.id }),
      lessonSkillFixture({ lessonId: first.id, skillId: wordSkill.id }),
    ]);

    const targets = await listLessonFieldItemTargets({
      field: "retail",
      lessonIds: [first.id, second.id],
    });

    expect(targets.map((target) => target.skill.id)).toStrictEqual([firstSkill.id, secondSkill.id]);
  });
});
