import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { pickPlacementItemSkills, recordPlacementPrepared } from "./placement-item-skills";
import { pickSpeculativeLessons } from "./speculative-lessons";

const CITATION = { passage: "Cinco alternativas.", sourceId: "source" };

/** A Cebraspe notice: every objective item is an assertion judged right or wrong. */
const CEBRASPE_STRUCTURE = {
  formats: [
    {
      citation: CITATION,
      description: "Itens julgados Certo ou Errado.",
      kind: "trueFalse",
      options: null,
    },
    { citation: CITATION, description: "Prova discursiva.", kind: "essay", options: null },
  ],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "Um item errado anula um certo.", method: "wrongCancelsRight" },
    sections: [],
    timeLimitMinutes: null,
    totalQuestions: 120,
  },
  rules: [],
  subjects: [],
};

const ENEM_STRUCTURE = {
  formats: [
    { citation: CITATION, description: "Questões objetivas.", kind: "multipleChoice", options: 5 },
  ],
  mock: null,
  rules: [],
  subjects: [],
};

const TRUE_FALSE_CONTENT = {
  context: null,
  isTrue: true,
  misconception: null,
  reason: "It follows the rule.",
  statement: "The rule applies here.",
};

const TYPED_CONTENT = {
  acceptedAnswers: [],
  context: null,
  keyPoints: ["Names the rule"],
  question: "Which rule applies?",
  sampleAnswer: "The rule.",
};

async function examGoalWithSkills({ count, structure }: { count: number; structure: object }) {
  const user = await userFixture();

  const [blueprint, skills] = await Promise.all([
    examBlueprintFixture({ name: "Polícia Federal", structure }),
    Promise.all(Array.from({ length: count }, () => skillFixture())),
  ]);

  const goal = await goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id });

  return { blueprint, goal, skillIds: skills.map((skill) => skill.id) };
}

async function planWithLessons({ phases, written = [] }: { phases: number[]; written?: number[] }) {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const lessons = await Promise.all(
    phases.map((_, index) =>
      libraryLessonFixture({ contentStatus: written.includes(index) ? "completed" : "pending" }),
    ),
  );

  await Promise.all(
    lessons.map((lesson, position) =>
      planItemFixture({
        lessonId: lesson.id,
        phase: phases[position] ?? 0,
        planId: plan.id,
        position,
      }),
    ),
  );

  return { goalId: goal.id, lessonIds: lessons.map((lesson) => lesson.id) };
}

describe(pickSpeculativeLessons, () => {
  it("guesses the first phase and the one the learner's own level points at", async () => {
    const { goalId, lessonIds } = await planWithLessons({ phases: [0, 0, 1, 1, 2, 2, 3, 3] });

    await expect(pickSpeculativeLessons({ goalId, ownLevel: "advanced" })).resolves.toStrictEqual([
      [lessonIds[0], lessonIds[1]],
      [lessonIds[4], lessonIds[5]],
    ]);
  });

  it("guesses only the first phase of a one-phase plan, and nothing for an empty one", async () => {
    const [single, empty] = await Promise.all([
      planWithLessons({ phases: [0, 0, 0, 0, 0] }),
      planWithLessons({ phases: [] }),
    ]);

    await expect(
      pickSpeculativeLessons({ goalId: single.goalId, ownLevel: null }),
    ).resolves.toStrictEqual([single.lessonIds.slice(0, 4)]);

    await expect(
      pickSpeculativeLessons({ goalId: empty.goalId, ownLevel: "basic" }),
    ).resolves.toStrictEqual([]);
  });

  it("picks the first two unwritten lessons of each likely starting phase", async () => {
    const { goalId, lessonIds } = await planWithLessons({
      phases: [0, 0, 0, 1, 1, 1],
      written: [0],
    });

    // Without a level, the second guess is the next phase. The first lesson is already written
    // (found in the Library), so the next two are guessed instead.
    await expect(pickSpeculativeLessons({ goalId, ownLevel: null })).resolves.toStrictEqual([
      [lessonIds[1], lessonIds[2]],
      [lessonIds[3], lessonIds[4]],
    ]);
  });

  it("guesses only the first phase for a learner starting from nothing, who skips placement", async () => {
    const { goalId, lessonIds } = await planWithLessons({ phases: [0, 0, 0, 0, 0, 1, 1] });

    await expect(pickSpeculativeLessons({ goalId, ownLevel: "none" })).resolves.toStrictEqual([
      lessonIds.slice(0, 4),
    ]);
  });
});

describe(pickPlacementItemSkills, () => {
  it("spreads picks across each phase, first and last included, and skips skills with questions", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const skills = await Promise.all(Array.from({ length: 9 }, () => skillFixture()));

    await itemFixture({ skillId: skills[7]?.id ?? "" });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [
          { milestone: null, name: "One" },
          { milestone: null, name: "Two" },
        ],
        skills: skills.map((skill, index) => ({
          area: null,
          lessons: 1,
          name: skill.name,
          phase: index < 7 ? 0 : 1,
          skillId: skill.id,
          weight: null,
        })),
      },
    });

    const { quickFormat, skills: picked } = await pickPlacementItemSkills({ goalId: goal.id });

    // Three evenly spaced skills of the first phase's seven; the second phase has only two, and one
    // of them already has a question.
    expect(quickFormat).toBe("multipleChoice");

    expect(picked.map((skill) => skill.id)).toStrictEqual([
      skills[0]?.id,
      skills[3]?.id,
      skills[6]?.id,
      skills[8]?.id,
    ]);

    await expect(prisma.item.count({ where: { skillId: skills[0]?.id } })).resolves.toBe(0);
  });

  it("takes the skills a run picked from the skill graph before the plan exists", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    await planFixture({ goalId: goal.id });

    const [first, answered, second] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    await itemFixture({ skillId: answered.id });

    const { skills: picked } = await pickPlacementItemSkills({
      goalId: goal.id,
      skillIds: [second.id, answered.id, first.id, second.id],
    });

    // In the order the run picked them, once each, and never a skill that already has questions.
    expect(picked.map((skill) => skill.id)).toStrictEqual([second.id, first.id]);
    expect(picked.every((skill) => skill.needsTyped)).toBe(true);
  });

  it("records when placement's questions for the goal's plan were written", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    await planFixture({ goalId: goal.id });

    await recordPlacementPrepared(goal.id);

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
    expect(plan.placementPreparedAt).toBeInstanceOf(Date);
  });

  it("writes an exam goal's questions the way the exam asks them", async () => {
    const user = await userFixture();
    const skill = await skillFixture();

    const blueprint = await examBlueprintFixture({
      name: "ENEM",
      structure: {
        formats: [
          {
            citation: CITATION,
            description: "Questões objetivas com texto-base.",
            kind: "multipleChoice",
            options: 5,
          },
        ],
        mock: null,
        rules: [],
        subjects: [],
      },
    });

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "One" }],
        skills: [
          {
            area: "Matemática",
            lessons: 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      },
    });

    const {
      quickFormat,
      skills: [picked],
    } = await pickPlacementItemSkills({ goalId: goal.id });

    expect(quickFormat).toBe("multipleChoice");

    expect(picked?.exam).toStrictEqual({
      blueprintId: blueprint.id,
      name: "ENEM",
      optionCount: 5,
      style: "multipleChoice (5 options): Questões objetivas com texto-base.",
    });
  });

  it("asks an exam that judges assertions in true or false, even where shared multiple choice exists", async () => {
    const { blueprint, goal, skillIds } = await examGoalWithSkills({
      count: 3,
      structure: CEBRASPE_STRUCTURE,
    });

    const [withChoice, withTrueFalse, bare] = skillIds;

    await Promise.all([
      itemFixture({ skillId: withChoice ?? "" }),
      itemFixture({ content: TYPED_CONTENT, format: "typed", skillId: withChoice ?? "" }),
      itemFixture({
        content: TRUE_FALSE_CONTENT,
        format: "trueFalse",
        skillId: withTrueFalse ?? "",
      }),
    ]);

    const { quickFormat, skills } = await pickPlacementItemSkills({ goalId: goal.id, skillIds });

    // Written before the notice was read, the multiple-choice questions don't count: true/false
    // ones are written, and the typed one it has is kept.
    expect(quickFormat).toBe("trueFalse");

    expect(skills.map((skill) => [skill.id, skill.needsTyped])).toStrictEqual([
      [withChoice, false],
      [bare, true],
    ]);

    expect(skills[0]?.exam?.blueprintId).toBe(blueprint.id);
  });

  it("counts only questions this goal can ask: never another exam's or a field's", async () => {
    const [{ blueprint, goal, skillIds }, otherExam] = await Promise.all([
      examGoalWithSkills({ count: 4, structure: ENEM_STRUCTURE }),
      examBlueprintFixture(),
    ]);

    const [otherExams, fields, ownExams, general] = skillIds;

    await Promise.all([
      itemFixture({ examBlueprintId: otherExam.id, skillId: otherExams ?? "" }),
      itemFixture({ field: "nursing", skillId: fields ?? "" }),
      itemFixture({ examBlueprintId: blueprint.id, skillId: ownExams ?? "" }),
      itemFixture({ skillId: general ?? "" }),
    ]);

    const { quickFormat, skills } = await pickPlacementItemSkills({ goalId: goal.id, skillIds });

    expect(quickFormat).toBe("multipleChoice");
    expect(skills.map((skill) => skill.id)).toStrictEqual([otherExams, fields]);
  });

  it("writes only the formats a caller asks for, such as a test-out's multiple choice", async () => {
    const { goal, skillIds } = await examGoalWithSkills({
      count: 1,
      structure: CEBRASPE_STRUCTURE,
    });

    const [skillId = ""] = skillIds;

    await itemFixture({ content: TRUE_FALSE_CONTENT, format: "trueFalse", skillId });

    await expect(
      pickPlacementItemSkills({ formats: ["multipleChoice"], goalId: goal.id, skillIds }),
    ).resolves.toMatchObject({
      quickFormat: "multipleChoice",
      skills: [{ id: skillId, needsTyped: false }],
    });
  });
});
