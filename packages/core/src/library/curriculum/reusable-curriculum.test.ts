import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  courseBandsFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { loadCourseOutline, plansFromCourseOutline } from "../../goals/_utils/course-outline";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { findBeyondNoticeSkillIds } from "../../plans/planner/beyond-notice-skills";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getSession } from "../../users/get-session";
import { getStartedCourseScope, pinPlanGraphToCourse } from "./course-start-graph";
import { type CurriculumScope } from "./curriculum-scope";
import { resetExamSkillGraphForAdmin } from "./exam-skill-graph-reset";
import { loadGoalCurriculumInputs } from "./goal-curriculum-inputs";
import { toGoalPlanGraph } from "./goal-plan-graph";
import { findReusableCurriculum, saveExamSkillGraph } from "./reusable-curriculum";

const SHARED: CurriculumScope = {
  generalGoal: "Immunology board exam",
  language: "pt",
  ownerId: null,
  targetLanguage: null,
};

type GoalAttrs = { details?: Record<string, unknown>; language?: string };

async function newGoal({
  blueprintId,
  details = {},
  language = "pt",
  primaryCourseId,
  userId,
}: GoalAttrs & { blueprintId: string; primaryCourseId?: string; userId?: string }) {
  const user = userId ? { id: userId } : await userFixture();

  const goal = await goalFixture({
    details,
    examBlueprintId: blueprintId,
    kind: "exam",
    language,
    primaryCourseId,
    userId: user.id,
  });

  await planFixture({ goalId: goal.id });

  const inputs = await loadGoalCurriculumInputs(goal.id);

  if (!inputs) {
    throw new Error("The goal's curriculum inputs couldn't be read.");
  }

  return inputs;
}

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

    await builtGoal({ blueprintId: blueprint.id });

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

    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.toMatchObject({
      courseIdsByKey: { [built.course.id]: built.course.id },
    });
  });

  it("writes a new graph when the exam's doesn't fit the learner", async () => {
    const [blueprint, privateBlueprint] = await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
    ]);

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

    await expect(
      findReusableCurriculum({ inputs, scope: { ...SHARED, ownerId: inputs.goal.userId } }),
    ).resolves.toBeNull();

    await expect(findReusableCurriculum({ inputs, scope: SHARED })).resolves.not.toBeNull();
  });
});

async function storedExamGraph() {
  const [blueprint, examCourse, mathCourse, functions, english, reading] = await Promise.all([
    examBlueprintFixture({ language: "pt" }),
    courseFixture({ format: "exam", isPublished: true, language: "pt", title: "ENEM" }),
    courseFixture({ isPublished: true, language: "pt", title: "Matemática" }),
    skillFixture(),
    skillFixture(),
    skillFixture(),
  ]);

  const graph = {
    optionSkills: [
      {
        after: functions.id,
        area: "Inglês",
        courseIds: [examCourse.id],
        lessons: 2,
        name: english.name,
        phase: 0,
        skillId: english.id,
        weight: 1,
      },
    ],
    phases: [
      { milestone: "Resolver funções", name: "Fundamentos" },
      { milestone: null, name: "Prática" },
    ],
    skills: [
      {
        area: "Matemática",
        courseIds: [examCourse.id],
        lessons: 3,
        name: functions.name,
        outcome: true,
        phase: 0,
        skillId: functions.id,
        topics: ["Funções"],
        weight: 4,
      },
      {
        area: null,
        courseIds: [examCourse.id, mathCourse.id],
        lessons: 4,
        name: reading.name,
        phase: 1,
        skillId: reading.id,
        weight: null,
      },
    ],
  };

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: new Date(),
      graph,
      model: "openai/gpt-6-sol",
      primaryCourseId: examCourse.id,
      promptVersion: "v1",
      runId: crypto.randomUUID(),
    },
  });

  return { blueprint, english, examCourse, functions, graph, reading };
}

async function courseStart({
  blueprintId,
  course,
  details = {},
}: {
  blueprintId: string;
  course: { id: string; title: string; userId: string | null; visibility: string };
  details?: Record<string, unknown>;
}) {
  const inputs = await newGoal({
    blueprintId,
    details: { ...details, courseStart: { chapterId: null } },
    primaryCourseId: course.id,
    userId: course.visibility === "private" ? (course.userId ?? undefined) : undefined,
  });

  if (!inputs.startedCourse) {
    throw new Error("The goal wasn't started from its course.");
  }

  const scope = getStartedCourseScope({ course: inputs.startedCourse, goal: inputs.goal });
  return { inputs, scope };
}

describe("reusing an exam's graph for a learner who started its course", () => {
  it("plans from the exam's graph, every skill learned in the course they started", async () => {
    const { blueprint, english, examCourse, functions, graph, reading } = await storedExamGraph();
    const { inputs, scope } = await courseStart({ blueprintId: blueprint.id, course: examCourse });

    const reused = await findReusableCurriculum({ inputs, scope });

    expect(reused ? toGoalPlanGraph(reused) : null).toStrictEqual(
      pinPlanGraphToCourse({ course: examCourse, graph: parsePlanGraph(graph) }),
    );

    expect(reused?.primaryCourseId).toBe(examCourse.id);
    expect(reused?.courseIdsByKey).toStrictEqual({ [examCourse.id]: examCourse.id });

    expect(reused ? toGoalPlanGraph(reused) : null).toStrictEqual({
      phases: [
        { milestone: "Resolver funções", name: "Fundamentos" },
        { milestone: "", name: "Prática" },
      ],
      skills: [
        {
          area: "Matemática",
          courseIds: [examCourse.id],
          lessons: 3,
          name: functions.name,
          outcome: true,
          phase: 0,
          skillId: functions.id,
          topics: ["Funções"],
          weight: 4,
        },
        {
          area: "Inglês",
          courseIds: [examCourse.id],
          lessons: 2,
          name: english.name,
          phase: 0,
          skillId: english.id,
          weight: 1,
        },
        {
          area: "ENEM",
          courseIds: [examCourse.id],
          lessons: 4,
          name: reading.name,
          phase: 1,
          skillId: reading.id,
          weight: null,
        },
      ],
    });
  });

  it("plans the course's written outline skills as outlined, through to the plan it creates", async () => {
    const { blueprint, examCourse, functions, reading } = await storedExamGraph();

    const [band] = await courseBandsFixture({ courseId: examCourse.id, levels: ["beginner"] });
    const { inputs, scope } = await courseStart({ blueprintId: blueprint.id, course: examCourse });

    const reused = await findReusableCurriculum({ inputs, scope });

    if (!reused) {
      throw new Error("The exam's graph wasn't reused.");
    }

    await createGoalPlan({
      goalId: inputs.goal.id,
      graph: toGoalPlanGraph(reused),
      setup: "steps",
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: inputs.goal.id } });

    const outlinedBySkill = new Map(
      parsePlanGraph(plan.graph).skills.map((skill) => [skill.skillId, skill.outlined]),
    );

    expect(outlinedBySkill.has(band?.skill.id ?? "")).toBe(true);
    expect(outlinedBySkill.get(band?.skill.id ?? "")).toBe(true);
    expect(outlinedBySkill.get(functions.id)).toBeUndefined();
    expect(outlinedBySkill.get(reading.id)).toBeUndefined();
  });

  it("keeps a written outline skill's declared and unknown notice topics through to the plan", async () => {
    const [blueprint, course, declared, noticed, unknown, written, older] = await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      courseFixture({ format: "exam", isPublished: true, language: "pt", title: "ENEM" }),
      skillFixture(),
      skillFixture(),
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    const examSkill = (skill: { id: string; name: string }, topics?: string[]) => ({
      area: "Matemática",
      courseIds: [course.id],
      lessons: 2,
      name: skill.name,
      phase: 0,
      skillId: skill.id,
      ...(topics ? { topics } : {}),
      weight: 2,
    });

    const graph = {
      phases: [{ milestone: null, name: "Fundamentos" }],
      skills: [examSkill(declared, []), examSkill(noticed, ["Funções"]), examSkill(unknown)],
    };

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: new Date(),
        graph,
        model: "openai/gpt-6-sol",
        primaryCourseId: course.id,
        promptVersion: "v1",
        runId: crypto.randomUUID(),
      },
    });

    await Promise.all(
      [
        { lessonSkill: written, position: 0, tag: declared },
        { lessonSkill: older, position: 1, tag: unknown },
      ].map(async ({ lessonSkill, position, tag }) => {
        const [chapter, lesson] = await Promise.all([
          libraryChapterFixture(),
          libraryLessonFixture(),
        ]);

        await Promise.all([
          courseChapterFixture({
            area: "Matemática",
            chapterId: chapter.id,
            courseId: course.id,
            position,
          }),
          chapterSkillFixture({ chapterId: chapter.id, skillId: tag.id }),
          chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: lessonSkill.id }),
        ]);
      }),
    );

    const { inputs, scope } = await courseStart({ blueprintId: blueprint.id, course });
    const reused = await findReusableCurriculum({ inputs, scope });

    if (!reused) {
      throw new Error("The exam's graph wasn't reused.");
    }

    await createGoalPlan({
      goalId: inputs.goal.id,
      graph: toGoalPlanGraph(reused),
      setup: "steps",
    });

    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: inputs.goal.id } });
    const planned = parsePlanGraph(plan.graph);
    const bySkill = new Map(planned.skills.map((skill) => [skill.skillId, skill]));

    expect(bySkill.get(written.id)).toMatchObject({ outlined: true, topics: [] });
    expect(bySkill.get(older.id)).toMatchObject({ outlined: true });
    expect(bySkill.get(older.id)?.topics).toBeUndefined();

    const estimated = pinPlanGraphToCourse({
      chapters: await loadCourseOutline({ courseId: course.id, userId: null }),
      course,
      graph: parsePlanGraph(graph),
    });

    const beyond = findBeyondNoticeSkillIds(planned);

    expect(beyond.has(written.id)).toBe(true);
    expect(beyond.has(older.id)).toBe(false);
    expect(beyond).toStrictEqual(findBeyondNoticeSkillIds(estimated));
  });

  it("writes its own graph for a private, unrelated or followed-up course start", async () => {
    const { blueprint, examCourse } = await storedExamGraph();
    const owner = await userFixture();

    const [privateCourse, otherCourse] = await Promise.all([
      courseFixture({ language: "pt", userId: owner.id, visibility: "private" }),
      courseFixture({ isPublished: true, language: "pt" }),
    ]);

    const [inPrivate, inOther, followedUp] = await Promise.all([
      courseStart({ blueprintId: blueprint.id, course: privateCourse }),
      courseStart({ blueprintId: blueprint.id, course: otherCourse }),
      courseStart({
        blueprintId: blueprint.id,
        course: examCourse,
        details: { followUps: [{ answer: "Nurse", question: "What do you do?" }] },
      }),
    ]);

    await expect(findReusableCurriculum(inPrivate)).resolves.toBeNull();
    await expect(findReusableCurriculum(inOther)).resolves.toBeNull();
    await expect(findReusableCurriculum(followedUp)).resolves.toBeNull();
  });

  it("never keeps a course start's graph as the exam's", async () => {
    const [blueprint, course, skill] = await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      courseFixture({ format: "exam", isPublished: true, language: "pt" }),
      skillFixture(),
    ]);

    const started = await courseStart({ blueprintId: blueprint.id, course });

    await saveExamSkillGraph({
      ...started,
      graph: {
        phases: [{ milestone: null, name: "Fundamentos" }],
        skills: [
          {
            area: null,
            courseIds: [course.id],
            lessons: 2,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      },
      provenance: {
        generatedAt: new Date(),
        model: "openai/gpt-6-sol",
        promptVersion: "v1",
        runId: crypto.randomUUID(),
      },
    });

    await expect(
      prisma.examSkillGraph.findUnique({ where: { examBlueprintId: blueprint.id } }),
    ).resolves.toBeNull();
  });
});

async function placedChapter({
  area = null,
  courseId,
  position,
  skills,
}: {
  area?: string | null;
  courseId: string;
  position: number;
  skills: readonly { id: string }[];
}) {
  const [chapter, lesson] = await Promise.all([libraryChapterFixture(), libraryLessonFixture()]);

  await Promise.all([
    courseChapterFixture({ area, chapterId: chapter.id, courseId, position }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    ...skills.map((skill) => lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id })),
  ]);
}

const examGraphSkill = (
  skill: { id: string; name: string },
  { area, courseIds, phase = 0 }: { area: string; courseIds?: string[]; phase?: number },
) => ({ area, courseIds, lessons: 2, name: skill.name, phase, skillId: skill.id, weight: 2 });

async function examOfTwoCourses() {
  const [blueprint, wholeCourse, subjectCourse, own, uncoursed, option, subject] =
    await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      courseFixture({ format: "exam", isPublished: true, language: "pt", title: "ENEM" }),
      courseFixture({
        format: "exam",
        isPublished: true,
        language: "pt",
        title: "ENEM Matemática",
      }),
      skillFixture(),
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

  const graph = {
    optionSkills: [
      { ...examGraphSkill(option, { area: "Inglês", courseIds: [wholeCourse.id] }), after: own.id },
    ],
    phases: [
      { milestone: null, name: "Fundamentos" },
      { milestone: null, name: "Matemática" },
    ],
    skills: [
      examGraphSkill(own, { area: "Linguagens", courseIds: [wholeCourse.id] }),
      examGraphSkill(uncoursed, { area: "Ciências Humanas" }),
      examGraphSkill(subject, { area: "Matemática", courseIds: [subjectCourse.id], phase: 1 }),
    ],
  };

  await Promise.all([
    prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: new Date(),
        graph,
        model: "openai/gpt-6-sol",
        primaryCourseId: wholeCourse.id,
        promptVersion: "v1",
        runId: crypto.randomUUID(),
      },
    }),
    itemFixture({ examBlueprintId: blueprint.id, language: "pt", skillId: subject.id }),
    placedChapter({
      area: "Matemática",
      courseId: subjectCourse.id,
      position: 0,
      skills: [subject],
    }),
  ]);

  return { blueprint, graph, option, own, subject, subjectCourse, uncoursed, wholeCourse };
}

describe("the part of an exam's graph a started course plans", () => {
  it("plans a whole-exam course's own and courseless skills, the same ones its full outline needs", async () => {
    const { blueprint, graph, option, own, uncoursed, wholeCourse } = await examOfTwoCourses();
    const { inputs, scope } = await courseStart({ blueprintId: blueprint.id, course: wholeCourse });

    const reused = await findReusableCurriculum({ inputs, scope });
    const planned = reused ? toGoalPlanGraph(reused) : null;

    expect(planned?.skills.map((skill) => skill.skillId)).toStrictEqual([
      own.id,
      option.id,
      uncoursed.id,
    ]);

    expect(planned?.phases.map((phase) => phase.name)).toStrictEqual(["Fundamentos"]);

    const examGraph = parsePlanGraph(graph);

    const outline = (chapters: Awaited<ReturnType<typeof loadCourseOutline>>) =>
      plansFromCourseOutline({
        chapterId: null,
        chapters,
        courseFormat: wholeCourse.format,
        courseId: wholeCourse.id,
        examGraph,
        outlineStatus: null,
      });

    await placedChapter({ courseId: wholeCourse.id, position: 0, skills: [own, uncoursed] });

    expect(outline(await loadCourseOutline({ courseId: wholeCourse.id, userId: null }))).toBe(
      false,
    );

    await placedChapter({ courseId: wholeCourse.id, position: 1, skills: [option] });

    expect(outline(await loadCourseOutline({ courseId: wholeCourse.id, userId: null }))).toBe(true);
  });

  it("plans a subject course's own and courseless skills, never another area its outline has", async () => {
    const { blueprint, subject, subjectCourse, uncoursed } = await examOfTwoCourses();
    const extra = await skillFixture();

    await placedChapter({
      area: "Linguagens",
      courseId: subjectCourse.id,
      position: 1,
      skills: [extra],
    });

    const { inputs, scope } = await courseStart({
      blueprintId: blueprint.id,
      course: subjectCourse,
    });

    const reused = await findReusableCurriculum({ inputs, scope });
    const planned = reused ? toGoalPlanGraph(reused) : null;

    expect(planned?.skills.map((skill) => [skill.skillId, skill.area, skill.phase])).toStrictEqual([
      [uncoursed.id, "Ciências Humanas", 0],
      [subject.id, "Matemática", 1],
    ]);

    expect(planned?.skills.every((skill) => skill.courseIds?.[0] === subjectCourse.id)).toBe(true);
  });

  it("plans an unnamed exam course from the whole graph, the same skills its full outline needs", async () => {
    const [blueprint, enem, languages, math, reading, option, algebra] = await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      courseFixture({ format: "exam", isPublished: true, language: "pt", title: "ENEM" }),
      courseFixture({ isPublished: true, language: "pt", title: "Linguagens" }),
      courseFixture({ isPublished: true, language: "pt", title: "Matemática" }),
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    const graph = {
      optionSkills: [
        {
          ...examGraphSkill(option, { area: "Inglês", courseIds: [languages.id] }),
          after: reading.id,
        },
      ],
      phases: [
        { milestone: null, name: "Fundamentos" },
        { milestone: null, name: "Aprofundamento" },
      ],
      skills: [
        examGraphSkill(reading, { area: "Linguagens", courseIds: [languages.id] }),
        examGraphSkill(algebra, { area: "Matemática", courseIds: [math.id], phase: 1 }),
      ],
    };

    await Promise.all([
      prisma.examSkillGraph.create({
        data: {
          examBlueprintId: blueprint.id,
          generatedAt: new Date(),
          graph,
          model: "openai/gpt-6-sol",
          primaryCourseId: languages.id,
          promptVersion: "v1",
          runId: crypto.randomUUID(),
        },
      }),
      itemFixture({ examBlueprintId: blueprint.id, language: "pt", skillId: reading.id }),
      placedChapter({ area: "Linguagens", courseId: enem.id, position: 0, skills: [reading] }),
    ]);

    const { inputs, scope } = await courseStart({ blueprintId: blueprint.id, course: enem });
    const reused = await findReusableCurriculum({ inputs, scope });
    const planned = reused ? toGoalPlanGraph(reused) : null;

    expect(planned?.skills.map((skill) => skill.skillId)).toStrictEqual([
      reading.id,
      option.id,
      algebra.id,
    ]);

    expect(planned?.phases.map((phase) => phase.name)).toStrictEqual([
      "Fundamentos",
      "Aprofundamento",
    ]);

    expect(planned?.skills.every((skill) => skill.courseIds?.[0] === enem.id)).toBe(true);

    const examGraph = parsePlanGraph(graph);

    const outline = async () =>
      plansFromCourseOutline({
        chapterId: null,
        chapters: await loadCourseOutline({ courseId: enem.id, userId: null }),
        courseFormat: enem.format,
        courseId: enem.id,
        examGraph,
        outlineStatus: null,
      });

    await placedChapter({ area: "Matemática", courseId: enem.id, position: 1, skills: [algebra] });
    await expect(outline()).resolves.toBe(false);

    await placedChapter({ area: "Linguagens", courseId: enem.id, position: 2, skills: [option] });
    await expect(outline()).resolves.toBe(true);
  });

  it("writes its own graph for a course the exam's graph opens with but gives no skill", async () => {
    const [blueprint, hub, languages, reading] = await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      courseFixture({ isPublished: true, language: "pt", title: "Vestibulares" }),
      courseFixture({ isPublished: true, language: "pt", title: "Linguagens" }),
      skillFixture(),
    ]);

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: new Date(),
        graph: {
          phases: [{ milestone: null, name: "Fundamentos" }],
          skills: [examGraphSkill(reading, { area: "Linguagens", courseIds: [languages.id] })],
        },
        model: "openai/gpt-6-sol",
        primaryCourseId: hub.id,
        promptVersion: "v1",
        runId: crypto.randomUUID(),
      },
    });

    const started = await courseStart({ blueprintId: blueprint.id, course: hub });

    await expect(findReusableCurriculum(started)).resolves.toBeNull();
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

describe("saving an exam's graph again", () => {
  it("marks the exam's plans only when its graph changes, never for another run's", async () => {
    const blueprint = await examBlueprintFixture({ language: "pt" });
    const runId = crypto.randomUUID();
    const built = await builtGoal({ blueprintId: blueprint.id, runId });
    const plan = await prisma.plan.findFirstOrThrow({ where: { goalId: built.inputs.goal.id } });
    const readPlan = () => prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const provenance = {
      generatedAt: new Date(),
      model: "openai/gpt-6-sol",
      promptVersion: "v1",
      runId,
    };

    const save = (graph: typeof built.graph, run = provenance) =>
      saveExamSkillGraph({ graph, inputs: built.inputs, provenance: run, scope: SHARED });

    await save(built.graph);

    await expect(readPlan()).resolves.toMatchObject({ inputVersion: plan.inputVersion });

    await save(
      { ...built.graph, skills: built.graph.skills.slice(0, 1) },
      { ...provenance, runId: crypto.randomUUID() },
    );

    await expect(readPlan()).resolves.toMatchObject({ inputVersion: plan.inputVersion });

    const added = await skillFixture();

    await save({
      ...built.graph,
      skills: [...built.graph.skills, { ...built.graph.skills[0], skillId: added.id }],
    } as typeof built.graph);

    await expect(readPlan()).resolves.toMatchObject({ inputVersion: plan.inputVersion + 1 });
  });
});
