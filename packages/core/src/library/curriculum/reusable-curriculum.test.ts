import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getSession } from "../../users/get-session";
import { type CurriculumScope } from "./curriculum-scope";
import { resetExamSkillGraphForAdmin } from "./exam-skill-graph-reset";
import { loadGoalCurriculumInputs } from "./goal-curriculum-inputs";
import { findReusableCurriculum, saveExamSkillGraph } from "./reusable-curriculum";

const SHARED: CurriculumScope = {
  generalGoal: "Immunology board exam",
  language: "pt",
  ownerId: null,
  targetLanguage: null,
};

type GoalAttrs = { details?: Record<string, unknown>; language?: string };

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

/**
 * An exam goal on the notice whose shared graph was written: two skills in one course, saved as
 * the exam's graph by the run that wrote it (`runId`, `promptVersion`).
 */
async function builtGoal({
  blueprintId,
  details = {},
  promptVersion = "v1",
  runId = crypto.randomUUID(),
  visibility = "public",
}: GoalAttrs & {
  blueprintId: string;
  promptVersion?: string;
  runId?: string;
  visibility?: "private" | "public";
}) {
  const [inputs, course, skills] = await Promise.all([
    newGoal({ blueprintId, details }),
    courseFixture({ visibility }),
    Promise.all([skillFixture(), skillFixture()]),
  ]);

  await prisma.goal.update({ data: { primaryCourseId: course.id }, where: { id: inputs.goal.id } });

  const graph = {
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
  };

  await saveExamSkillGraph({
    graph,
    inputs,
    provenance: { generatedAt: new Date(), model: "openai/gpt-6-sol", promptVersion, runId },
    scope: SHARED,
  });

  return { course, graph, inputs, skills };
}

function idsOf(skills: readonly { id: string }[]) {
  return Object.fromEntries(skills.map((skill) => [skill.id, skill.id]));
}

describe(findReusableCurriculum, () => {
  it("plans every later learner from the exam's graph, whatever prompt version wrote it", async () => {
    const blueprint = await examBlueprintFixture({ language: "pt" });

    // Written long ago by instructions that changed since: still the exam's, with no new graph.
    const built = await builtGoal({ blueprintId: blueprint.id, promptVersion: "older" });
    const inputs = await newGoal({ blueprintId: blueprint.id });

    const reused = await findReusableCurriculum({ inputs, scope: SHARED });

    expect(reused?.idsByKey).toStrictEqual(idsOf(built.skills));
    expect(reused?.courseIdsByKey).toStrictEqual({ [built.course.id]: built.course.id });
    expect(reused?.primaryCourseId).toBe(built.course.id);
    expect(reused?.provenance.promptVersion).toBe("older");

    expect(reused?.graph.skills.map((skill) => [skill.area, skill.phase])).toStrictEqual([
      ["Immunology", 1],
      ["Immunology", 1],
    ]);
  });

  it("keeps the exam's graph when every learner who had the exam is deleted", async () => {
    const blueprint = await examBlueprintFixture({ language: "pt" });
    const built = await builtGoal({ blueprintId: blueprint.id });

    // The only learner of the exam leaves: their goal and plan go, the exam's graph stays.
    await prisma.user.delete({ where: { id: built.inputs.goal.userId } });

    const inputs = await newGoal({ blueprintId: blueprint.id });

    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.toMatchObject({
      idsByKey: idsOf(built.skills),
    });
  });

  it("keeps the first graph written for the exam, which only the same run can complete", async () => {
    const blueprint = await examBlueprintFixture({ language: "pt" });
    const runId = crypto.randomUUID();
    const first = await builtGoal({ blueprintId: blueprint.id, runId });

    // Another learner's run wrote a graph at the same time: the exam keeps the first one.
    await builtGoal({ blueprintId: blueprint.id });

    // The first run's reading of the notice adds a skill: the exam's graph gains it.
    const added = await skillFixture();

    await saveExamSkillGraph({
      graph: {
        ...first.graph,
        skills: [...first.graph.skills, { ...first.graph.skills[0], skillId: added.id }],
      } as typeof first.graph,
      inputs: first.inputs,
      provenance: {
        generatedAt: new Date(),
        model: "openai/gpt-6-sol",
        promptVersion: "v1",
        runId,
      },
      scope: SHARED,
    });

    const inputs = await newGoal({ blueprintId: blueprint.id });

    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.toMatchObject({
      idsByKey: idsOf([...first.skills, added]),
    });
  });

  it("reuses the exam's graph for a learner who gave another level", async () => {
    const blueprint = await examBlueprintFixture({ language: "pt" });

    const built = await builtGoal({ blueprintId: blueprint.id, details: { level: "advanced" } });
    const inputs = await newGoal({ blueprintId: blueprint.id, details: { level: "none" } });

    // Their level decides where they start, not which graph is written.
    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.toMatchObject({
      courseIdsByKey: { [built.course.id]: built.course.id },
    });
  });

  it("writes a new graph when the exam's doesn't fit the learner", async () => {
    const [blueprint, privateBlueprint] = await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
    ]);

    // A graph in a private course is its learner's; a learner in another language gets their own.
    await Promise.all([
      builtGoal({ blueprintId: privateBlueprint.id, visibility: "private" }),
      builtGoal({ blueprintId: blueprint.id }),
    ]);

    const [inPrivate, english] = await Promise.all([
      newGoal({ blueprintId: privateBlueprint.id }),
      newGoal({ blueprintId: blueprint.id, language: "en" }),
    ]);

    await expect(findReusableCurriculum({ inputs: inPrivate, scope: SHARED })).resolves.toBeNull();

    await expect(
      findReusableCurriculum({ inputs: english, scope: { ...SHARED, language: "en" } }),
    ).resolves.toBeNull();
  });

  it("never reuses or keeps a graph shaped by a learner's answers or scope", async () => {
    const blueprint = await examBlueprintFixture({ language: "pt" });

    // A graph written from a learner's answers is theirs: the exam keeps none.
    await builtGoal({
      blueprintId: blueprint.id,
      details: { followUps: [{ answer: "Nurse", question: "What do you do?" }] },
    });

    const inputs = await newGoal({ blueprintId: blueprint.id });
    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.toBeNull();

    await builtGoal({ blueprintId: blueprint.id });

    const followedUp = await newGoal({
      blueprintId: blueprint.id,
      details: { followUps: [{ answer: "Nurse", question: "What do you do?" }] },
    });

    await expect(findReusableCurriculum({ inputs: followedUp, scope: SHARED })).resolves.toBeNull();

    // A private course is written for its learner.
    await expect(
      findReusableCurriculum({ inputs, scope: { ...SHARED, ownerId: inputs.goal.userId } }),
    ).resolves.toBeNull();

    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.not.toBeNull();
  });
});

describe(resetExamSkillGraphForAdmin, () => {
  it("lets an admin reset an exam's graph, so its next learner writes a new one", async () => {
    const [blueprint, admin, learner] = await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      userFixture({ role: "admin" }),
      userFixture(),
    ]);

    await builtGoal({ blueprintId: blueprint.id });
    const inputs = await newGoal({ blueprintId: blueprint.id });

    mockSession(learner.id);

    await expect(
      resetExamSkillGraphForAdmin({ examBlueprintId: blueprint.id }),
    ).resolves.toStrictEqual({ status: "forbidden" });

    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.not.toBeNull();

    vi.mocked(getSession).mockResolvedValue(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The reset only reads the identity and role.
      { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
    );

    await expect(
      resetExamSkillGraphForAdmin({ examBlueprintId: blueprint.id }),
    ).resolves.toStrictEqual({ status: "reset" });

    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.toBeNull();
  });
});
