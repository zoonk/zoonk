import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadSkillEvidence } from "../learner/_utils/load-skill-claims";
import { planLibraryFixture } from "./_test-utils/plan-library";

describe("a skill the learner showed they know", () => {
  it("is never a test-out of another skill whose lessons the Library links to it later", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 0, size: 2 }] });
    const [journey, caseStudy] = library.skills.map((skill) => skill.id);
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id, graph: library.graph });

    await Promise.all(
      library.lessons.map((lesson, position) =>
        planItemFixture({
          completedAt: new Date("2026-10-14T12:00:00Z"),
          lessonId: lesson.id,
          planId: plan.id,
          position,
          skillId: journey ?? null,
          status: "testedOut",
        }),
      ),
    );

    await Promise.all(
      library.lessons.map((lesson) =>
        lessonSkillFixture({ lessonId: lesson.id, skillId: caseStudy ?? "" }),
      ),
    );

    const { known } = await loadSkillEvidence({
      goalId: goal.id,
      skillIds: [journey ?? "", caseStudy ?? ""],
      userId: user.id,
    });

    expect([...known]).toStrictEqual([journey]);
  });
});
