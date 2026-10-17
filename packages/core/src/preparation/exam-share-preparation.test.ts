import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getGoalPreparation } from "./get-goal-preparation";

describe(getGoalPreparation, () => {
  it("weighs equal exam shares equally through the authenticated preparation capability", async () => {
    const [user, blueprint, math, ...languages] = await Promise.all([
      userFixture(),
      examBlueprintFixture({
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: ["Math", "Language"].map((name) => ({
            citation: { passage: "Exam subjects", sourceId: "notice" },
            name,
            questions: 20,
            topics: [],
            weight: 0.5,
          })),
        },
      }),
      skillFixture(),
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      timezone: "UTC",
      userId: user.id,
    });

    const graphSkills = [math, ...languages].map((entry, index) => ({
      area: index === 0 ? "Math" : "Language",
      lessons: 1,
      name: entry.name,
      phase: 0,
      skillId: entry.id,
      weight: 1,
    }));

    const plan = await planFixture({
      goalId: goal.id,
      graph: { phases: [{ name: "Foundations" }], skills: graphSkills },
    });

    const studiedAt = new Date(Date.now() - 60_000);

    await Promise.all([
      ...graphSkills.map((entry, position) =>
        planItemFixture({ planId: plan.id, position, skillId: entry.skillId }),
      ),
      attemptFixture({ answeredAt: studiedAt, skillId: math.id, userId: user.id }),
      learnerSkillFixture({
        difficulty: 5,
        lastReviewedAt: studiedAt,
        recallDays: 1,
        reps: 2,
        skillId: math.id,
        stability: 10,
        state: "learning",
        userId: user.id,
      }),
    ]);

    mockSession(user.id);
    const result = await getGoalPreparation(goal.id);
    expect(result.status).toBe("ready");

    if (result.status !== "ready") {
      throw new Error("The fixture's owned exam goal must have preparation");
    }

    const { sections, value } = result.preparation;
    expect(sections.map(({ weight }) => weight)).toStrictEqual([0.5, 0.5]);
    expect(sections[0]?.preparation).toBeGreaterThan(0);
    expect(sections[1]?.preparation).toBe(0);
    expect(value).toBeCloseTo((sections[0]?.preparation ?? 0) / 2);

    await prisma.goal.update({
      data: { examBlueprintId: null, kind: "language" },
      where: { id: goal.id },
    });

    const language = await getGoalPreparation(goal.id);
    expect(language.status).toBe("ready");

    if (language.status !== "ready") {
      throw new Error("The converted language goal must still have preparation");
    }

    expect(language.preparation.sections.map(({ weight }) => weight)).toStrictEqual([0.25, 0.75]);

    expect(language.preparation.value).toBeCloseTo(
      (language.preparation.sections[0]?.preparation ?? 0) / 4,
    );

    // The changed measurement is reused by the goal's read without changing who may read it.
    mockSession(null);
    await expect(getGoalPreparation(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });
    const other = await userFixture();
    mockSession(other.id);
    await expect(getGoalPreparation(goal.id)).resolves.toStrictEqual({ status: "notFound" });
  });
});
