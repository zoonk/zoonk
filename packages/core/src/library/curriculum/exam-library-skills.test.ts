import { randomUUID } from "node:crypto";
import { type Course, type ExamBlueprint, type Skill, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonsFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillsFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { createGoalPlan } from "../../plans/create-goal-plan";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { loadExamLibrarySkills } from "./exam-library-skills";
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

describe(loadExamLibrarySkills, () => {
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

    const listed = await loadExamLibrarySkills({
      courseIds: [course.id],
      examBlueprintId: blueprint.id,
      language: "pt",
    });

    expect(listed.map((skill) => skill.id).toSorted()).toStrictEqual(
      [base!.id, placed!.id].toSorted(),
    );

    expect(listed.find((skill) => skill.id === placed!.id)).toMatchObject({
      courseId: course.id,
      lessons: 6,
      level: "intermediate",
      prerequisiteIds: [base!.id],
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
    expect(await prisma.skill.count()).toBe(skillCount);

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
