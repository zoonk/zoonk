import { generateWholeSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { classifyGoalSpecificity } from "@zoonk/ai/tasks/identity/goal-specificity";
import { loadGoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { getStreamedEvents } from "../../_test-utils/parse-stream-events";
import { recordedOutput, taskResult } from "../../_test-utils/recorded-outputs";
import { buildGoalSkillGraph } from "../goal-skill-graph";
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

async function loadInputs(goalId: string) {
  const inputs = await loadGoalCurriculumInputs(goalId);

  if (!inputs) {
    throw new Error("The goal's curriculum inputs should load");
  }

  return inputs;
}

describe(decideGoalScopeStep, () => {
  it("shares a language goal's content by the language it teaches, never by the title the learner gave it", async () => {
    const user = await userFixture();

    const languageGoal = await goalFixture({
      kind: "language",
      language: "en",
      targetLanguage: "es",
      title: "Spanish to talk with Maria's family in Seville",
      userId: user.id,
    });

    const scope = await decideGoalScopeStep({
      inputs: await loadInputs(languageGoal.id),
      workflowRunId: "run",
    });

    expect(scope).toMatchObject({ generalGoal: "Spanish", ownerId: null, targetLanguage: "es" });
  });

  it("keeps a goal private when nothing general remains to share, instead of sharing its title", async () => {
    const user = await userFixture();

    const learnGoal = await goalFixture({
      kind: "learn",
      language: "en",
      prompt: "Learn the Acme sales playbook Maria wrote",
      title: "Acme sales playbook",
      userId: user.id,
    });

    vi.mocked(classifyGoalSpecificity).mockResolvedValue(
      taskResult({ generalGoal: null, personalDetails: ["Acme", "Maria"], privateCourse: false }),
    );

    const scope = await decideGoalScopeStep({
      inputs: await loadInputs(learnGoal.id),
      workflowRunId: "run",
    });

    expect(scope).toMatchObject({ generalGoal: null, ownerId: user.id });
  });

  it("shares a started public course's content by the course's title, never by the goal's", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, title: "Cell biology" }),
    ]);

    const startedGoal = await goalFixture({
      details: { courseStart: { chapterId: null } },
      kind: "learn",
      primaryCourseId: course.id,
      title: "Biology for Maria's nursing exam",
      userId: user.id,
    });

    const scope = await decideGoalScopeStep({
      inputs: await loadInputs(startedGoal.id),
      workflowRunId: "run",
    });

    expect(scope).toMatchObject({ generalGoal: "Cell biology", ownerId: null });
  });

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

describe(buildGoalSkillGraph, () => {
  it("streams each skill's name as the graph is written, between the step's start and end", async () => {
    const user = await userFixture();
    const learnGoal = await goalFixture({ kind: "learn", language: "pt", userId: user.id });

    vi.mocked(generateWholeSkillGraph).mockImplementation(async ({ onSkillNamed }) => {
      await onSkillNamed?.("Variáveis");
      await onSkillNamed?.("Laços");
      return { ...taskResult(recordedOutput("skill-graph")), repaired: [] } as never;
    });

    await buildGoalSkillGraph({
      inputs: await loadInputs(learnGoal.id),
      scope: shared,
      workflowRunId: "run",
    });

    const report = { entityId: learnGoal.id, step: "buildSkillGraph" };

    expect(getStreamedEvents()).toStrictEqual([
      { ...report, status: "started" },
      { ...report, skillName: "Variáveis", status: "started" },
      { ...report, skillName: "Laços", status: "started" },
      { ...report, status: "completed" },
    ]);
  });
});
