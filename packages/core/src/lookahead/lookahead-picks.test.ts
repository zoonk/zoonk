import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { pickPlacementItemSkills, recordPlacementPrepared } from "./placement-item-skills";
import { pickPlanStartToWrite, pickSpeculativeLessons } from "./speculative-lessons";

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

/** A multiple-choice question with `count` options, the first one right. */
function choiceContent(count: number) {
  return {
    options: Array.from({ length: count }, (_, index) => ({
      isCorrect: index === 0,
      reason: index === 0 ? null : "A common mix-up.",
      text: `Option ${index + 1}`,
    })),
    question: "Which option is right?",
  };
}

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

async function planWithLessons({
  details = {},
  phases,
  personal = false,
  written = [],
}: {
  details?: object;
  phases: number[];
  /** The plan's lessons are the learner's own, from a course only they read (their material). */
  personal?: boolean;
  written?: number[];
}) {
  const user = await userFixture();
  const goal = await goalFixture({ details, userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const lessons = await Promise.all(
    phases.map((_, index) =>
      libraryLessonFixture({
        contentStatus: written.includes(index) ? "completed" : "pending",
        ...(personal ? { ownerId: user.id, visibility: "private" as const } : {}),
      }),
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

    await expect(
      pickSpeculativeLessons({ count: 4, goalId, ownLevel: "advanced" }),
    ).resolves.toStrictEqual([
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
      pickSpeculativeLessons({ count: 4, goalId: single.goalId, ownLevel: null }),
    ).resolves.toStrictEqual([single.lessonIds.slice(0, 4)]);

    await expect(
      pickSpeculativeLessons({ count: 4, goalId: empty.goalId, ownLevel: "basic" }),
    ).resolves.toStrictEqual([]);
  });

  it("picks the first two unwritten lessons of each likely starting phase", async () => {
    const { goalId, lessonIds } = await planWithLessons({
      phases: [0, 0, 0, 1, 1, 1],
      written: [0],
    });

    // Without a level, the second guess is the next phase. The first lesson is already written
    // (found in the Library), so the next two are guessed instead.
    await expect(
      pickSpeculativeLessons({ count: 4, goalId, ownLevel: null }),
    ).resolves.toStrictEqual([
      [lessonIds[1], lessonIds[2]],
      [lessonIds[3], lessonIds[4]],
    ]);
  });

  it("writes fewer lessons ahead for a learner whose plan writes less ahead", async () => {
    const { goalId, lessonIds } = await planWithLessons({ phases: [0, 0, 0, 1, 1, 1] });

    await expect(
      pickSpeculativeLessons({ count: 2, goalId, ownLevel: null }),
    ).resolves.toStrictEqual([[lessonIds[0]], [lessonIds[3]]]);
  });

  it("leaves the learner's own lessons for after placement, which may test them out", async () => {
    // A class test's lessons from the learner's notes: nobody else reads them, so a lesson
    // placement tests out would be written for nothing.
    const during = await planWithLessons({ personal: true, phases: [0, 0, 0] });

    await expect(
      pickSpeculativeLessons({ count: 4, goalId: during.goalId, ownLevel: "basic" }),
    ).resolves.toStrictEqual([]);

    await expect(pickPlanStartToWrite(during.goalId)).resolves.toBeNull();

    const after = await planWithLessons({
      details: { answered: ["placement"] },
      personal: true,
      phases: [0, 0, 0],
    });

    await expect(
      pickSpeculativeLessons({ count: 4, goalId: after.goalId, ownLevel: "basic" }),
    ).resolves.toStrictEqual([after.lessonIds]);

    await expect(pickPlanStartToWrite(after.goalId)).resolves.toBe(after.lessonIds[0]);
  });

  it("writes a shared plan's start during placement: another learner reads a wrong guess", async () => {
    const { goalId, lessonIds } = await planWithLessons({ phases: [0, 0, 0] });

    await expect(pickPlanStartToWrite(goalId)).resolves.toBe(lessonIds[0]);
  });

  it("guesses only the first phase for a learner starting from nothing, who skips placement", async () => {
    const { goalId, lessonIds } = await planWithLessons({ phases: [0, 0, 0, 0, 0, 1, 1] });

    await expect(
      pickSpeculativeLessons({ count: 4, goalId, ownLevel: "none" }),
    ).resolves.toStrictEqual([lessonIds.slice(0, 4)]);
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

  it("gives a language goal's skills the language their questions practice", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "language", targetLanguage: "en", userId: user.id });
    await planFixture({ goalId: goal.id });

    const interview = await skillFixture({ language: "pt", targetLanguage: "en" });

    const { skills: picked } = await pickPlacementItemSkills({
      goalId: goal.id,
      skillIds: [interview.id],
    });

    expect(picked.map((skill) => [skill.language, skill.targetLanguage])).toStrictEqual([
      ["pt", "en"],
    ]);
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

    // Written before the notice was read, the general questions don't count for its placement:
    // the exam's own true/false and typed ones are written.
    expect(quickFormat).toBe("trueFalse");

    expect(skills.map((skill) => [skill.id, skill.needsTyped])).toStrictEqual([
      [withChoice, true],
      [withTrueFalse, true],
      [bare, true],
    ]);

    expect(skills[0]?.exam?.blueprintId).toBe(blueprint.id);
  });

  it("writes an exam's own questions where only general ones exist, once for every learner of it", async () => {
    const [{ blueprint, goal, skillIds }, otherExam] = await Promise.all([
      examGoalWithSkills({ count: 4, structure: ENEM_STRUCTURE }),
      examBlueprintFixture(),
    ]);

    const [otherExams, fields, ownExams, general] = skillIds;

    await Promise.all([
      itemFixture({ examBlueprintId: otherExam.id, skillId: otherExams ?? "" }),
      itemFixture({ field: "nursing", skillId: fields ?? "" }),
      itemFixture({
        content: choiceContent(5),
        examBlueprintId: blueprint.id,
        skillId: ownExams ?? "",
      }),
      itemFixture({
        content: TYPED_CONTENT,
        examBlueprintId: blueprint.id,
        format: "typed",
        skillId: ownExams ?? "",
      }),
      itemFixture({ skillId: general ?? "" }),
    ]);

    const { quickFormat, skills } = await pickPlacementItemSkills({ goalId: goal.id, skillIds });

    expect(quickFormat).toBe("multipleChoice");
    expect(skills.map((skill) => skill.id)).toStrictEqual([otherExams, fields, general]);
    expect(skills.every((skill) => skill.exam?.blueprintId === blueprint.id)).toBe(true);

    // Once written, the exam's questions are shared: the next learner of the exam needs none.
    const [nextLearner] = await Promise.all([
      userFixture(),
      ...skills.flatMap((skill) => [
        itemFixture({
          content: choiceContent(5),
          examBlueprintId: blueprint.id,
          skillId: skill.id,
        }),
        itemFixture({
          content: TYPED_CONTENT,
          examBlueprintId: blueprint.id,
          format: "typed",
          skillId: skill.id,
        }),
      ]),
    ]);

    const nextGoal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      userId: nextLearner.id,
    });

    await expect(pickPlacementItemSkills({ goalId: nextGoal.id, skillIds })).resolves.toMatchObject(
      { skills: [] },
    );
  });

  it("writes the exam's five-option questions for a skill whose exam questions have four", async () => {
    const { blueprint, goal, skillIds } = await examGoalWithSkills({
      count: 2,
      structure: ENEM_STRUCTURE,
    });

    const [fourOptions = "", fiveOptions = ""] = skillIds;

    await Promise.all(
      [
        { content: choiceContent(4), skillId: fourOptions },
        { content: choiceContent(5), skillId: fiveOptions },
        { content: TYPED_CONTENT, format: "typed" as const, skillId: fourOptions },
        { content: TYPED_CONTENT, format: "typed" as const, skillId: fiveOptions },
      ].map((attrs) => itemFixture({ ...attrs, examBlueprintId: blueprint.id })),
    );

    // Placement only asks ENEM questions with ENEM's five options, so the old four-option ones
    // can't stand for the skill: it gets five-option ones, and keeps its typed confirmation.
    await expect(pickPlacementItemSkills({ goalId: goal.id, skillIds })).resolves.toMatchObject({
      quickFormat: "multipleChoice",
      skills: [{ id: fourOptions, needsTyped: false }],
    });
  });

  it("writes five-option questions for a notice that leaves the count to its latest edition", async () => {
    const { blueprint, goal, skillIds } = await examGoalWithSkills({
      count: 2,
      structure: {
        ...ENEM_STRUCTURE,
        formats: [{ ...ENEM_STRUCTURE.formats[0], options: null }],
        pastOptions: {
          checkedAt: "2026-10-07T00:00:00.000Z",
          edition: "Enem 2025",
          options: 5,
          source: { title: null, url: "https://www.gov.br/inep" },
        },
      },
    });

    const [fourOptions = "", fiveOptions = ""] = skillIds;

    await Promise.all(
      [
        { content: choiceContent(4), skillId: fourOptions },
        { content: choiceContent(5), skillId: fiveOptions },
        { content: TYPED_CONTENT, format: "typed" as const, skillId: fourOptions },
        { content: TYPED_CONTENT, format: "typed" as const, skillId: fiveOptions },
      ].map((attrs) => itemFixture({ ...attrs, examBlueprintId: blueprint.id })),
    );

    await expect(pickPlacementItemSkills({ goalId: goal.id, skillIds })).resolves.toMatchObject({
      skills: [{ exam: { optionCount: 5 }, id: fourOptions }],
    });
  });

  it("counts for a focus test only questions the learner hasn't answered, with the exam's options", async () => {
    const { blueprint, goal, skillIds } = await examGoalWithSkills({
      count: 3,
      structure: ENEM_STRUCTURE,
    });

    const [answered = "", unanswered = "", fourOptions = ""] = skillIds;

    const [seen] = await Promise.all([
      itemFixture({ content: choiceContent(5), examBlueprintId: blueprint.id, skillId: answered }),
      itemFixture({ content: choiceContent(5), skillId: unanswered }),
      itemFixture({ content: choiceContent(4), skillId: fourOptions }),
    ]);

    await attemptFixture({ itemId: seen.id, skillId: answered, userId: goal.userId });

    const picks = await pickPlacementItemSkills({
      exceptAnswered: true,
      formats: ["multipleChoice"],
      goalId: goal.id,
      skillIds,
    });

    expect(picks.skills.map((skill) => skill.id)).toStrictEqual([answered, fourOptions]);
  });

  it("counts general questions for a goal without an exam", async () => {
    const user = await userFixture();
    const [goal, skill] = await Promise.all([goalFixture({ userId: user.id }), skillFixture()]);

    await Promise.all([
      itemFixture({ skillId: skill.id }),
      itemFixture({ content: TYPED_CONTENT, format: "typed", skillId: skill.id }),
    ]);

    await expect(
      pickPlacementItemSkills({ goalId: goal.id, skillIds: [skill.id] }),
    ).resolves.toMatchObject({ skills: [] });
  });

  it("writes only the formats a caller asks for, such as a test-out's multiple choice", async () => {
    const { goal, skillIds } = await examGoalWithSkills({
      count: 2,
      structure: CEBRASPE_STRUCTURE,
    });

    const [skillId = "", withGeneralChoice = ""] = skillIds;

    await Promise.all([
      itemFixture({ content: TRUE_FALSE_CONTENT, format: "trueFalse", skillId }),
      itemFixture({ skillId: withGeneralChoice }),
    ]);

    // A test-out asks general multiple choice too, so only the skill without any gets questions.
    await expect(
      pickPlacementItemSkills({ formats: ["multipleChoice"], goalId: goal.id, skillIds }),
    ).resolves.toMatchObject({
      quickFormat: "multipleChoice",
      skills: [{ id: skillId, needsTyped: false }],
    });
  });

  it("writes for a skill short of the questions a test-out asks of it, not only for one with none", async () => {
    const { goal, skillIds } = await examGoalWithSkills({
      count: 2,
      structure: CEBRASPE_STRUCTURE,
    });

    const [short = "", enough = ""] = skillIds;

    // A chapter of one skill asks it several times: one question isn't enough for four.
    await Promise.all([
      itemFixture({ skillId: short }),
      ...Array.from({ length: 4 }, () => itemFixture({ skillId: enough })),
    ]);

    await expect(
      pickPlacementItemSkills({
        formats: ["multipleChoice"],
        goalId: goal.id,
        quickNeeded: 4,
        skillIds,
      }),
    ).resolves.toMatchObject({ skills: [{ id: short }] });
  });

  it("names the situations a skill's questions already use, so new ones put it in others", async () => {
    const { goal, skillIds } = await examGoalWithSkills({ count: 1, structure: ENEM_STRUCTURE });
    const [skillId = ""] = skillIds;

    await itemFixture({
      content: {
        context:
          "Moradores de Olinda marcaram uma reunião pacífica na praça central, sem armas, e avisaram a prefeitura.",
        options: [
          { isCorrect: true, text: "Pode, pois basta o aviso prévio." },
          {
            isCorrect: false,
            reason: "Não depende de autorização.",
            text: "Depende de autorização.",
          },
        ],
        question: "A reunião pode acontecer?",
      },
      skillId,
    });

    const picked = await pickPlacementItemSkills({
      formats: ["multipleChoice"],
      goalId: goal.id,
      quickNeeded: 4,
      skillIds,
    });

    expect(picked.skills[0]?.usedSituations).toStrictEqual([
      "Moradores de Olinda marcaram uma reunião pacífica na praça central, sem armas, e avisaram a prefeitura.",
    ]);
  });
});
