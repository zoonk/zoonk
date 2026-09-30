import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { listPlanOutlineNeeds } from "./plan-outline-needs";

describe(listPlanOutlineNeeds, () => {
  it("lists the bands a copied plan's courses still need, the course reached first first", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ title: "Learn statistics", userId: user.id });

    const [shared, own] = await Promise.all([
      courseFixture({ language: "pt" }),
      courseFixture({ userId: user.id, visibility: "private" }),
    ]);

    const [written, basics, advanced, notes] = await Promise.all([
      skillFixture({ level: "beginner" }),
      skillFixture({ level: "beginner" }),
      skillFixture({ level: "advanced" }),
      skillFixture({ level: null }),
    ]);

    const courseOf = new Map([
      [written.id, shared.id],
      [basics.id, shared.id],
      [advanced.id, shared.id],
      [notes.id, own.id],
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "One" }],
        skills: [notes, written, basics, advanced].map((skill) => ({
          area: null,
          courseIds: [courseOf.get(skill.id) ?? ""],
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
    });

    const lesson = await libraryLessonFixture();

    await Promise.all([
      planItemFixture({ planId: plan.id, position: 0, skillId: notes.id }),
      planItemFixture({ lessonId: lesson.id, planId: plan.id, position: 1, skillId: written.id }),
      planItemFixture({ planId: plan.id, position: 2, skillId: basics.id }),
      planItemFixture({ planId: plan.id, position: 3, skillId: advanced.id }),
      planItemFixture({ planId: plan.id, position: 4, skillId: basics.id, status: "done" }),
    ]);

    const toRef = (skill: typeof basics) => ({
      description: skill.description,
      id: skill.id,
      key: skill.id,
      name: skill.name,
    });

    await expect(listPlanOutlineNeeds(goal.id)).resolves.toStrictEqual([
      {
        bands: [{ level: "beginner", skills: [toRef(notes)] }],
        courseId: own.id,
        scope: { generalGoal: null, language: "en", ownerId: user.id, targetLanguage: null },
      },
      {
        bands: [
          { level: "beginner", skills: [toRef(basics)] },
          { level: "advanced", skills: [toRef(advanced)] },
        ],
        courseId: shared.id,
        scope: {
          generalGoal: "Learn statistics",
          language: "pt",
          ownerId: null,
          targetLanguage: null,
        },
      },
    ]);
  });

  it("needs nothing when every lesson of the plan is in its courses already", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });
    const lesson = await libraryLessonFixture();

    await planItemFixture({ lessonId: lesson.id, planId: plan.id, position: 0 });

    await expect(listPlanOutlineNeeds(goal.id)).resolves.toStrictEqual([]);
  });
});
