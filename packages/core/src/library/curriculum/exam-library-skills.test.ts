import { randomUUID } from "node:crypto";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { type Course, type ExamBlueprint, type Skill, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonsFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture, skillsFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { findExamLibrary } from "./exam-library-skills";
import {
  type GoalSkillGraph,
  linkGoalSkillPrerequisites,
  saveGoalSkills,
} from "./save-goal-skills";

const scope = { generalGoal: "Concurso", language: "pt", ownerId: null, targetLanguage: null };

const provenance = { generatedAt: new Date(), model: "test", promptVersion: "test", runId: "test" };

function toPlanGraph(placed: readonly { course: Course; lessons?: number; skill: Skill }[]) {
  return {
    phases: [{ milestone: "Base", name: "Base" }],
    skills: placed.map(({ course, lessons = 4, skill }) => ({
      area: "Direito Constitucional",
      courseIds: [course.id],
      lessons,
      name: skill.name,
      phase: 0,
      skillId: skill.id,
      topics: [],
      weight: 3,
    })),
  } satisfies PlanGraph;
}

async function examGraphFixture({
  blueprint,
  graph,
}: {
  blueprint: ExamBlueprint;
  graph: PlanGraph;
}) {
  await prisma.examSkillGraph.create({
    data: { ...provenance, examBlueprintId: blueprint.id, graph, runId: randomUUID() },
  });
}

function graphSkill(
  skill: Pick<Skill, "description" | "name">,
  attrs: Partial<GoalSkillGraph["skills"][number]> = {},
): GoalSkillGraph["skills"][number] {
  return {
    area: "Direito Constitucional",
    course: "constitucional",
    description: skill.description,
    estimatedLessons: 4,
    examWeight: 3,
    key: randomUUID(),
    level: "intermediate",
    name: skill.name,
    phase: 1,
    prerequisites: [],
    topics: [],
    ...attrs,
  };
}

describe("Library skills", () => {
  it("offers chapter skills without an exam graph, sized by distinct lessons across their chapters", async () => {
    const [course, blueprint, skill] = await Promise.all([
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
    ]);

    const chapter = await libraryChapterFixture({ homeCourseId: course.id, language: "pt" });
    const sharedChapter = await libraryChapterFixture({ language: "pt" });
    const lessons = await libraryLessonsFixture(2, { homeChapterId: chapter.id, language: "pt" });
    await libraryLessonsFixture(1, { homeChapterId: sharedChapter.id, language: "pt" });

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
      courseChapterFixture({ chapterId: sharedChapter.id, courseId: course.id, position: 1 }),
      chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
      chapterSkillFixture({ chapterId: sharedChapter.id, skillId: skill.id }),
      ...lessons.flatMap((lesson, position) =>
        [chapter, sharedChapter].map((placed) =>
          chapterLessonFixture({ chapterId: placed.id, lessonId: lesson.id, position }),
        ),
      ),
    ]);

    const { skills: listed } = await findExamLibrary({
      courseIdsByKey: { [course.id]: course.id },
      examBlueprintId: blueprint.id,
      language: "pt",
    });

    expect(listed).toMatchObject([{ course: course.id, id: skill.id, lessons: 3 }]);
  });

  it("does not offer a chapter skill when its chapter has no lessons", async () => {
    const [course, blueprint, skill] = await Promise.all([
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
    ]);

    const chapter = await libraryChapterFixture({ homeCourseId: course.id, language: "pt" });
    await chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id });

    const library = await findExamLibrary({
      courseIdsByKey: { subject: course.id },
      examBlueprintId: blueprint.id,
      language: "pt",
    });

    expect(library.skills).toStrictEqual([]);
  });

  it("does not offer lesson-only skills in the course pool", async () => {
    const [course, blueprint, skill] = await Promise.all([
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      skillFixture({ language: "pt" }),
    ]);

    const chapter = await libraryChapterFixture({ homeCourseId: course.id, language: "pt" });
    const lessons = await libraryLessonsFixture(2, { homeChapterId: chapter.id, language: "pt" });

    await Promise.all(
      lessons.map((lesson) => lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id })),
    );

    const library = await findExamLibrary({
      courseIdsByKey: { subject: course.id },
      examBlueprintId: blueprint.id,
      language: "pt",
    });

    expect(library.skills).toStrictEqual([]);
  });

  it("sorts graph placements before chapter skills and keeps their stored size", async () => {
    const [course, blueprint, otherBlueprint, taught, placed] = await Promise.all([
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      skillFixture({ id: `00000000-${randomUUID().slice(9)}`, language: "pt" }),
      skillFixture({ id: `ffffffff-${randomUUID().slice(9)}`, language: "pt" }),
    ]);

    const chapter = await libraryChapterFixture({ homeCourseId: course.id, language: "pt" });
    const lessons = await libraryLessonsFixture(2, { homeChapterId: chapter.id, language: "pt" });

    await Promise.all([
      chapterSkillFixture({ chapterId: chapter.id, skillId: taught.id }),
      chapterSkillFixture({ chapterId: chapter.id, skillId: placed.id }),
      ...lessons.map((lesson) => lessonSkillFixture({ lessonId: lesson.id, skillId: placed.id })),
      examGraphFixture({
        blueprint: otherBlueprint,
        graph: toPlanGraph([{ course, lessons: 1, skill: placed }]),
      }),
    ]);

    const library = await findExamLibrary({
      courseIdsByKey: { subject: course.id },
      examBlueprintId: blueprint.id,
      language: "pt",
    });

    expect(library.skills.map(({ id }) => id)).toStrictEqual([placed.id, taught.id]);

    expect(library.skills).toMatchObject([
      { id: placed.id, lessons: 1 },
      { id: taught.id, lessons: 2 },
    ]);
  });

  it("lists the public skills other exams' graphs place in the courses, with their size and links", async () => {
    const [course, otherCourse, blueprint, otherBlueprint] = await Promise.all([
      courseFixture({ language: "pt" }),
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
    ]);

    const [base, placed, elsewhere, own, merged] = await skillsFixture(
      ["Base", "Placed", "Elsewhere", "Own", "Merged"].map((name) => `${name} ${randomUUID()}`),
      { language: "pt", level: "intermediate" },
    );

    await prisma.skill.update({ data: { mergedIntoId: base?.id }, where: { id: merged?.id } });

    await prisma.skillPrerequisite.create({
      data: { prerequisiteId: base!.id, skillId: placed!.id },
    });

    await Promise.all([
      examGraphFixture({
        blueprint: otherBlueprint,
        graph: toPlanGraph([
          { course, skill: base! },
          { course, lessons: 6, skill: placed! },
          { course: otherCourse, skill: elsewhere! },
          { course, skill: merged! },
        ]),
      }),
      examGraphFixture({ blueprint, graph: toPlanGraph([{ course, skill: own! }]) }),
    ]);

    const { skills: listed } = await findExamLibrary({
      courseIdsByKey: { [course.id]: course.id },
      examBlueprintId: blueprint.id,
      language: "pt",
    });

    expect(listed.map((skill) => skill.id).toSorted()).toStrictEqual(
      [base!.id, placed!.id].toSorted(),
    );

    expect(listed.find((skill) => skill.id === placed!.id)).toMatchObject({
      course: course.id,
      lessons: 6,
      level: "intermediate",
      prerequisiteIds: [base!.id],
    });
  });
});

describe(findExamLibrary, () => {
  it("reads resolved frame courses without writing one or asking a model", async () => {
    const [blueprint, otherBlueprint] = await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
    ]);

    const [physics, [placed]] = await Promise.all([
      courseFixture({ language: "pt", title: `Física ${randomUUID()}` }),
      skillsFixture([`Placed ${randomUUID()}`], { language: "pt" }),
    ]);

    await examGraphFixture({
      blueprint: otherBlueprint,
      graph: toPlanGraph([{ course: physics, skill: placed! }]),
    });

    const library = await findExamLibrary({
      courseIdsByKey: { physics: physics.id },
      examBlueprintId: blueprint.id,
      language: scope.language,
    });

    expect(library.skills.map((skill) => [skill.id, skill.course])).toStrictEqual([
      [placed!.id, "physics"],
    ]);

    expect(generateSearchTerms).not.toHaveBeenCalled();
    expect(decideLibraryIdentity).not.toHaveBeenCalled();
  });

  it("brings what a skill builds on from another discipline, however deep, with that course", async () => {
    const [blueprint, otherBlueprint, mathematics] = await Promise.all([
      examBlueprintFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      courseFixture({ language: "pt", title: `Matemática ${randomUUID()}` }),
    ]);

    const [physics, [arithmetic, equations, speeds]] = await Promise.all([
      courseFixture({ language: "pt", title: `Física ${randomUUID()}` }),
      skillsFixture(
        ["Arithmetic", "Equations", "Speeds"].map((name) => `${name} ${randomUUID()}`),
        { language: "pt" },
      ),
    ]);

    await prisma.skillPrerequisite.createMany({
      data: [
        { prerequisiteId: arithmetic!.id, skillId: equations!.id },
        { prerequisiteId: equations!.id, skillId: speeds!.id },
      ],
    });

    await examGraphFixture({
      blueprint: otherBlueprint,
      graph: toPlanGraph([
        { course: mathematics, skill: arithmetic! },
        { course: mathematics, skill: equations! },
        { course: physics, skill: speeds! },
      ]),
    });

    const library = await findExamLibrary({
      courseIdsByKey: { physics: physics.id },
      examBlueprintId: blueprint.id,
      language: scope.language,
    });

    expect(library.courses).toStrictEqual([{ key: mathematics.id, title: mathematics.title }]);

    expect(
      Object.fromEntries(library.skills.map((skill) => [skill.id, skill.course])),
    ).toStrictEqual({
      [arithmetic!.id]: mathematics.id,
      [equations!.id]: mathematics.id,
      [speeds!.id]: "physics",
    });
  });

  it("keeps a lesson-only prerequisite with the course that teaches it", async () => {
    const [physics, mathematics, blueprint, otherBlueprint, foundation, applied] =
      await Promise.all([
        courseFixture({ language: "pt" }),
        courseFixture({ language: "pt" }),
        examBlueprintFixture({ language: "pt" }),
        examBlueprintFixture({ language: "pt" }),
        skillFixture({ language: "pt" }),
        skillFixture({ language: "pt" }),
      ]);

    const chapter = await libraryChapterFixture({ homeCourseId: mathematics.id, language: "pt" });
    const lessons = await libraryLessonsFixture(2, { homeChapterId: chapter.id, language: "pt" });

    await Promise.all([
      ...lessons.map((lesson) =>
        lessonSkillFixture({ lessonId: lesson.id, skillId: foundation.id }),
      ),
      prisma.skillPrerequisite.create({
        data: { prerequisiteId: foundation.id, skillId: applied.id },
      }),
      examGraphFixture({
        blueprint: otherBlueprint,
        graph: toPlanGraph([{ course: physics, skill: applied }]),
      }),
    ]);

    const library = await findExamLibrary({
      courseIdsByKey: { physics: physics.id },
      examBlueprintId: blueprint.id,
      language: "pt",
    });

    expect(library.courses).toStrictEqual([{ key: mathematics.id, title: mathematics.title }]);

    expect(library.skills.find(({ id }) => id === foundation.id)).toMatchObject({
      course: mathematics.id,
      lessons: 2,
    });
  });
});

describe("reusing another exam's skills", () => {
  it("keeps the reused rows and their prerequisite links, whatever the new graph lists", async () => {
    const [base, placed] = await skillsFixture([`Base ${randomUUID()}`, `Placed ${randomUUID()}`], {
      language: "pt",
    });

    await prisma.skillPrerequisite.create({
      data: { prerequisiteId: base!.id, skillId: placed!.id },
    });

    const skillCount = await prisma.skill.count();

    const skills = [
      graphSkill(base!, { key: "base", libraryId: base!.id }),
      graphSkill(placed!, { key: "placed", libraryId: placed!.id }),
    ];

    const idsByKey = await saveGoalSkills({ provenance, scope, skills });

    expect(idsByKey).toStrictEqual({ base: base!.id, placed: placed!.id });
    await expect(prisma.skill.count()).resolves.toBe(skillCount);

    await linkGoalSkillPrerequisites({ idsByKey, skills });

    const links = await prisma.skillPrerequisite.findMany({ where: { skillId: placed!.id } });
    expect(links.map((link) => link.prerequisiteId)).toStrictEqual([base!.id]);
  });

  it("gives two exams that share a skill the same lesson rows in their plans", async () => {
    const [user, course, firstExam, secondExam] = await Promise.all([
      userFixture(),
      courseFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt" }),
    ]);

    const [shared] = await skillsFixture([`Shared ${randomUUID()}`], { language: "pt" });
    const chapter = await libraryChapterFixture({ language: "pt" });
    const lessons = await libraryLessonsFixture(2, { language: "pt" });

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      level: "intermediate",
    });

    await Promise.all(
      lessons.flatMap((lesson, position) => [
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: shared!.id }),
      ]),
    );

    const goals = await Promise.all(
      [firstExam, secondExam].map((exam) =>
        goalFixture({ examBlueprintId: exam.id, kind: "exam", language: "pt", userId: user.id }),
      ),
    );

    const graph = toPlanGraph([{ course, lessons: 2, skill: shared! }]);
    await Promise.all(goals.map((goal) => createGoalPlan({ goalId: goal.id, graph })));

    const planned = await Promise.all(
      goals.map((goal) =>
        prisma.planItem.findMany({
          orderBy: { position: "asc" },
          where: { lessonId: { not: null }, plan: { goalId: goal.id } },
        }),
      ),
    );

    const lessonIds = planned.map((items) => [...new Set(items.map((item) => item.lessonId))]);

    expect(lessonIds[0]).toStrictEqual(lessons.map((lesson) => lesson.id));
    expect(lessonIds[1]).toStrictEqual(lessonIds[0]);
  });
});
