import { SKILL_GRAPH_PROMPT_VERSION } from "@zoonk/ai/tasks/v2/curriculum/skill-graph-version";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { type CurriculumScope } from "./curriculum-scope";
import { loadGoalCurriculumInputs } from "./goal-curriculum-inputs";
import { findReusableCurriculum } from "./reusable-curriculum";

const SHARED: CurriculumScope = {
  generalGoal: "Immunology board exam",
  language: "pt",
  ownerId: null,
  targetLanguage: null,
};

type GoalAttrs = { details?: Record<string, unknown>; language?: string };

/** An exam goal on the notice whose plan was built from a two-skill graph in one course. */
async function builtGoal({
  blueprintId,
  details = {},
  generatedAt = new Date(),
  language = "pt",
  promptVersion = SKILL_GRAPH_PROMPT_VERSION,
  visibility = "public",
}: GoalAttrs & {
  blueprintId: string;
  generatedAt?: Date;
  promptVersion?: string;
  visibility?: "private" | "public";
}) {
  const user = await userFixture();

  const [goal, course, skills] = await Promise.all([
    goalFixture({ details, examBlueprintId: blueprintId, kind: "exam", language, userId: user.id }),
    courseFixture({ visibility }),
    Promise.all([skillFixture(), skillFixture()]),
  ]);

  await planFixture({
    generatedAt,
    goalId: goal.id,
    graph: {
      phases: [{ milestone: "Explain the basics", name: "Foundations" }],
      skills: skills.map((skill) => ({
        area: "Immunology",
        courseIds: [course.id],
        lessons: 3,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: 3,
      })),
    },
    model: "openai/gpt-6-sol",
    promptVersion,
    runId: crypto.randomUUID(),
  });

  return { course, goal, skills };
}

/** A new exam goal on the notice, before its graph, and what its curriculum reads. */
async function newGoal({
  blueprintId,
  details = {},
  language = "pt",
}: GoalAttrs & { blueprintId: string }) {
  const user = await userFixture();

  const goal = await goalFixture({
    details,
    examBlueprintId: blueprintId,
    kind: "exam",
    language,
    userId: user.id,
  });

  await planFixture({ goalId: goal.id });

  const inputs = await loadGoalCurriculumInputs(goal.id);

  if (!inputs) {
    throw new Error("The goal's curriculum inputs couldn't be read.");
  }

  return inputs;
}

describe(findReusableCurriculum, () => {
  it("reuses the newest curriculum built for the same notice, language and level", async () => {
    const blueprint = await examBlueprintFixture();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [older, newer, inputs] = await Promise.all([
      builtGoal({ blueprintId: blueprint.id, generatedAt: hourAgo }),
      builtGoal({ blueprintId: blueprint.id }),
      newGoal({ blueprintId: blueprint.id }),
    ]);

    const reused = await findReusableCurriculum({ inputs, scope: SHARED });

    expect(reused?.idsByKey).toStrictEqual(
      Object.fromEntries(newer.skills.map((skill) => [skill.id, skill.id])),
    );

    expect(reused?.courseIdsByKey).toStrictEqual({ [newer.course.id]: newer.course.id });
    expect(reused?.idsByKey).not.toHaveProperty(older.skills[0]?.id ?? "");

    expect(reused?.graph.skills.map((skill) => [skill.area, skill.phase])).toStrictEqual([
      ["Immunology", 1],
      ["Immunology", 1],
    ]);
  });

  it("writes a new graph when nothing built for the notice fits the learner", async () => {
    const blueprint = await examBlueprintFixture();

    // Built at another level, with older instructions, or in a private course: none is theirs.
    const [inputs, english] = await Promise.all([
      newGoal({ blueprintId: blueprint.id, details: { level: "basic" } }),
      newGoal({ blueprintId: blueprint.id, details: { level: "basic" }, language: "en" }),
      builtGoal({ blueprintId: blueprint.id, details: { level: "advanced" } }),
      builtGoal({ blueprintId: blueprint.id, details: { level: "basic" }, promptVersion: "older" }),
      builtGoal({ blueprintId: blueprint.id, details: { level: "basic" }, visibility: "private" }),
    ]);

    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.toBeNull();

    // A curriculum in another language never serves this one.
    const portuguese = await builtGoal({ blueprintId: blueprint.id, details: { level: "basic" } });

    await expect(
      findReusableCurriculum({ inputs: english, scope: { ...SHARED, language: "en" } }),
    ).resolves.toBeNull();

    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.toMatchObject({
      courseIdsByKey: { [portuguese.course.id]: portuguese.course.id },
    });
  });

  it("never reuses for a learner whose answers or scope shape their own graph", async () => {
    const blueprint = await examBlueprintFixture();
    await builtGoal({ blueprintId: blueprint.id });

    const [followedUp, inputs] = await Promise.all([
      newGoal({
        blueprintId: blueprint.id,
        details: { followUps: [{ answer: "Nurse", question: "What do you do?" }] },
      }),
      newGoal({ blueprintId: blueprint.id }),
    ]);

    await expect(findReusableCurriculum({ inputs: followedUp, scope: SHARED })).resolves.toBeNull();

    // A private course is written for its learner.
    await expect(
      findReusableCurriculum({ inputs, scope: { ...SHARED, ownerId: inputs.goal.userId } }),
    ).resolves.toBeNull();

    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.not.toBeNull();
  });
});
