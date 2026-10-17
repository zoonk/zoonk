import { loadGoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { decideGoalScopeStep, keepMaterialPrivate } from "./goal-curriculum-steps";

const goal = {
  examBlueprintId: null,
  id: "goal",
  kind: "learn" as const,
  language: "pt",
  prompt: "Biologia celular para a prova de sexta",
  targetLanguage: null,
  title: "Biologia celular",
  userId: "learner",
};

const shared = {
  generalGoal: "Biologia celular",
  language: "pt",
  ownerId: null,
  targetLanguage: null,
};

describe(keepMaterialPrivate, () => {
  // The scope is decided from the goal as typed while research reads what the learner uploads.
  it("makes a goal's curriculum private when its material linked after the scope was decided", () => {
    expect(
      keepMaterialPrivate({ inputs: { goal, hasMaterial: true }, scope: shared }),
    ).toStrictEqual({
      generalGoal: null,
      language: "pt",
      ownerId: "learner",
      targetLanguage: null,
    });
  });

  it("keeps a shared scope for a goal without material", () => {
    expect(keepMaterialPrivate({ inputs: { goal, hasMaterial: false }, scope: shared })).toBe(
      shared,
    );
  });
});

describe(decideGoalScopeStep, () => {
  // An exam course started as an exam goal wrote its missing bands as a general course, without
  // the exam's areas and style, since the started course's scope dropped the exam.
  it("keeps the exam a started exam course prepares for in its scope", async () => {
    const [user, course, blueprint] = await Promise.all([
      userFixture(),
      courseFixture({ format: "exam", isPublished: true, title: "OAB" }),
      examBlueprintFixture({ name: "OAB" }),
    ]);

    const startedGoal = await goalFixture({
      details: { courseStart: { chapterId: null } },
      examBlueprintId: blueprint.id,
      kind: "exam",
      primaryCourseId: course.id,
      title: "OAB",
      userId: user.id,
    });

    const inputs = await loadGoalCurriculumInputs(startedGoal.id);

    if (!inputs) {
      throw new Error("The goal's curriculum inputs should load");
    }

    await expect(decideGoalScopeStep({ inputs, workflowRunId: "run" })).resolves.toMatchObject({
      exams: [expect.objectContaining({ name: "OAB" })],
      generalGoal: "OAB",
      ownerId: null,
    });
  });
});
