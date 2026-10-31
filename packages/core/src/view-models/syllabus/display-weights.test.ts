import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { estimateNumbersFixture } from "../../catalog/_test-utils/estimate-numbers-fixture";
import { getSyllabusView } from "./get-syllabus-view";

describe("complete displayed exam weights", () => {
  it("includes the essay with its stated assumption and sums rounded weights to 100", async () => {
    const [fixture, user] = await Promise.all([estimateNumbersFixture(), userFixture()]);

    const goal = await goalFixture({
      examBlueprintId: fixture.blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: { ...fixture.graph, skills: fixture.graph.skills.slice(0, 4) },
    });

    mockSession(user.id);
    const result = await getSyllabusView({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error("Expected syllabus");
    }

    const weights = result.syllabus.subjects.filter((subject) => subject.source === "notice");
    expect(weights).toHaveLength(5);

    expect(weights.find((subject) => subject.name === "Essay")?.displayWeight).toStrictEqual({
      basis: "assumed",
      percent: 20,
      share: 0.2,
    });

    expect(weights.every((subject) => subject.displayWeight !== null)).toBe(true);
    expect(weights.reduce((sum, subject) => sum + subject.displayWeight!.percent, 0)).toBe(100);
    expect(weights.reduce((sum, subject) => sum + subject.displayWeight!.share, 0)).toBeCloseTo(1);

    expect(
      weights
        .filter((subject) => subject.name !== "Essay")
        .every((subject) => subject.displayWeight?.basis === "stated"),
    ).toBe(true);
  });

  it("conserves whole percentages with unequal shares and keeps zero weights at zero", async () => {
    const names = ["Math", "Science", "Languages", "Essay"];
    const shares = [1 / 3, 1 / 3, 1 / 3, 0];

    const [user, blueprint, skills] = await Promise.all([
      userFixture(),
      examBlueprintFixture({
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: names.map((name, index) => ({
            citation: { passage: "Stated subject weight", sourceId: "notice" },
            name,
            questions: null,
            topics: [],
            weight: shares[index],
          })),
        },
      }),
      Promise.all(names.map((name) => skillFixture({ name }))),
    ]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ name: "Subjects" }],
        skills: skills.map((skill, index) => ({
          area: names[index],
          lessons: 2,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
        })),
      },
    });

    mockSession(user.id);
    const result = await getSyllabusView({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error("Expected syllabus");
    }

    const percentages = result.syllabus.subjects.map((subject) => subject.displayWeight?.percent);
    expect(percentages).toStrictEqual([34, 33, 33, 0]);
    expect(result.syllabus.subjects.map((subject) => subject.share)).toStrictEqual(shares);
  });
});
