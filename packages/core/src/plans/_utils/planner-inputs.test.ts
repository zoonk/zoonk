import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  ENGLISH,
  FOREIGN,
  MATH,
  choiceBlueprintFixture,
} from "../../exams/choices/_test-utils/choice-blueprint";
import { type PlanGraph } from "../planner/plan-state";
import { chooseExamOptionSkills } from "./exam-option-skills";
import { loadGoalPlannerLessons, loadSkillLessons } from "./planner-lessons";

const citation = { passage: "passage", sourceId: "source" };

function examStructure(kind: "multipleChoice" | "practical") {
  return {
    formats: [{ citation, description: "The exam's questions", kind, options: null }],
    mock: null,
    rules: [],
    subjects: [],
  };
}

async function chapterOf({
  courseId,
  position,
  skillId,
  title,
  tools,
}: {
  courseId: string;
  position: number;
  skillId: string;
  title: string;
  tools: { essential: boolean; name: string }[];
}) {
  const chapter = await libraryChapterFixture({ level: "intermediate", title, tools });

  const lessons = await Promise.all(
    [1, 2].map((index) =>
      libraryLessonFixture({ homeChapterId: chapter.id, title: `${title} ${index}` }),
    ),
  );

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId, level: "intermediate", position }),
    chapterSkillFixture({ chapterId: chapter.id, skillId }),
    lessonSkillFixture({ lessonId: lessons[0]?.id ?? "", skillId }),
    ...lessons.map((lesson, index) =>
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: index }),
    ),
  ]);

  return lessons;
}

describe(loadSkillLessons, () => {
  it("leaves chapters that need a tool out of an exam answered without one", async () => {
    const [user, course, skill, written, practical] = await Promise.all([
      userFixture(),
      courseFixture({ title: "Electricity" }),
      skillFixture({ name: "Read circuit diagrams" }),
      examBlueprintFixture({ structure: examStructure("multipleChoice") }),
      examBlueprintFixture({ structure: examStructure("practical") }),
    ]);

    const [onPaper, withTool, helped] = await Promise.all([
      chapterOf({
        courseId: course.id,
        position: 0,
        skillId: skill.id,
        title: "Series and parallel circuits",
        tools: [],
      }),
      chapterOf({
        courseId: course.id,
        position: 1,
        skillId: skill.id,
        title: "Multi-sheet schematics",
        tools: [{ essential: true, name: "Schematic editor (KiCad)" }],
      }),
      chapterOf({
        courseId: course.id,
        position: 2,
        skillId: skill.id,
        title: "Measuring a circuit",
        tools: [{ essential: false, name: "Circuit simulator" }],
      }),
    ]);

    const load = (goal: Parameters<typeof loadSkillLessons>[0]["goal"]) =>
      loadSkillLessons({
        goal,
        skillCourses: new Map([[skill.id, [course.id]]]),
        skillIds: [skill.id],
        userId: user.id,
      }).then((lessons) => lessons.map((lesson) => lesson.lessonId).toSorted());

    const everything = [...onPaper, ...withTool, ...helped].map((lesson) => lesson.id).toSorted();
    const withoutTool = [...onPaper, ...helped].map((lesson) => lesson.id).toSorted();

    await expect(load({ examBlueprintId: written.id, kind: "exam" })).resolves.toStrictEqual(
      withoutTool,
    );

    await expect(load({ examBlueprintId: null, kind: "exam" })).resolves.toStrictEqual(withoutTool);

    await expect(load({ examBlueprintId: practical.id, kind: "exam" })).resolves.toStrictEqual(
      everything,
    );

    await expect(load({ examBlueprintId: null, kind: "learn" })).resolves.toStrictEqual(everything);
  });
});

async function bandChapterOf({
  courseId,
  level,
  position,
  skillId,
}: {
  courseId: string;
  level: "beginner" | "intermediate";
  position: number;
  skillId: string;
}) {
  const chapter = await libraryChapterFixture({ level, title: `${level} chapter` });

  const lesson = await libraryLessonFixture({
    homeChapterId: chapter.id,
    title: `${level} lesson`,
  });

  await Promise.all([
    courseChapterFixture({ chapterId: chapter.id, courseId, level, position }),
    chapterSkillFixture({ chapterId: chapter.id, skillId }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
  ]);

  return lesson;
}

describe(loadGoalPlannerLessons, () => {
  it("plans every band of a skill's course, the easier ones too", async () => {
    const [user, course, skill] = await Promise.all([
      userFixture(),
      courseFixture({ title: "Constitutional law" }),
      skillFixture({ name: "Read the Constitution's structure" }),
    ]);

    const [basicLesson, levelLesson] = await Promise.all([
      bandChapterOf({ courseId: course.id, level: "beginner", position: 0, skillId: skill.id }),
      bandChapterOf({ courseId: course.id, level: "intermediate", position: 1, skillId: skill.id }),
    ]);

    const goal = { examBlueprintId: null, kind: "learn" as const, primaryCourseId: null };

    const lessons = await loadGoalPlannerLessons({
      goal,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
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
      userId: user.id,
    });

    expect(lessons.map((lesson) => lesson.lessonId).toSorted()).toStrictEqual(
      [basicLesson.id, levelLesson.id].toSorted(),
    );
  });
});

function examSkill({
  area,
  lessons,
  skillId,
  topics = ["Topic"],
}: {
  area: string;
  lessons: number;
  skillId: string;
  topics?: string[];
}): PlanGraph["skills"][number] {
  return { area, lessons, name: skillId, phase: 0, skillId, topics, weight: 1 };
}

describe(chooseExamOptionSkills, () => {
  it("re-estimates a legacy exam's mixed and placeholder-only subjects on re-plan", async () => {
    const blueprint = await examBlueprintFixture({ structure: examStructure("multipleChoice") });

    const filled = Array.from({ length: 25 }, (_, index) =>
      examSkill({ area: "Systems", lessons: 2, skillId: `systems-${index}` }),
    );

    const stored: PlanGraph = {
      phases: [{ milestone: null, name: "Start" }],
      skills: [
        examSkill({
          area: "Mathematics",
          lessons: 12,
          skillId: "graphs",
          topics: ["Paths", "Cycles"],
        }),
        examSkill({ area: "Mathematics", lessons: 2, skillId: "sets" }),
        examSkill({ area: "Mathematics", lessons: 2, skillId: "limits" }),
        examSkill({ area: "Mathematics", lessons: 2, skillId: "derivatives" }),
        examSkill({
          area: "Auditing",
          lessons: 20,
          skillId: "public-budget",
          topics: ["Revenue", "Expenses"],
        }),
        ...filled,
      ],
    };

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: new Date(),
        graph: stored,
        model: "test",
        promptVersion: "test",
        runId: crypto.randomUUID(),
      },
    });

    const planned = await chooseExamOptionSkills({
      goal: { examBlueprintId: blueprint.id, kind: "exam" },
      graph: stored,
      picks: { examChoices: [], examSubjects: [] },
    });

    expect(planned.skills.map(({ skillId, lessons }) => [skillId, lessons])).toStrictEqual([
      ["graphs", 12],
      ["sets", 6],
      ["limits", 6],
      ["derivatives", 6],
      ["public-budget", 20],
      ...filled.map(({ skillId }) => [skillId, 8]),
    ]);

    const after = await prisma.examSkillGraph.findUniqueOrThrow({
      where: { examBlueprintId: blueprint.id },
    });

    expect(after.graph).toStrictEqual(stored);
  });

  it("loads the same exam estimates for plans with different saved sizes", async () => {
    const blueprint = await choiceBlueprintFixture();
    const item = { area: MATH, name: "Algebra", phase: 0, skillId: "algebra", weight: 1 };
    const option = { ...item, area: ENGLISH, name: "Read a passage", skillId: "reading" };
    const own = { ...item, lessons: 3, name: "Practice", skillId: "private-skill" };

    const small = {
      ...item,
      lessons: 2,
      name: "Read set notation",
      sizedEstimate: true as const,
      skillId: "notation",
    };

    const phases = [{ milestone: null, name: "Start" }];

    await prisma.examSkillGraph.create({
      data: {
        examBlueprintId: blueprint.id,
        generatedAt: new Date(),
        graph: { phases, skills: [{ ...item, lessons: 12 }, { ...option, lessons: 8 }, small] },
        model: "test/fixture",
        promptVersion: "test",
        runId: crypto.randomUUID(),
      },
    });

    const planned = await Promise.all(
      [4, 24].map((lessons) =>
        chooseExamOptionSkills({
          goal: { examBlueprintId: blueprint.id, kind: "exam" },
          graph: { phases, skills: [{ ...item, lessons }, { ...option, lessons }, small, own] },
          picks: { examChoices: [{ group: FOREIGN, subjects: [ENGLISH] }], examSubjects: [] },
        }),
      ),
    );

    for (const graph of planned) {
      expect(graph.skills).toStrictEqual([
        { ...item, lessons: 12 },
        { ...option, lessons: 8 },
        small,
        own,
      ]);
    }
  });
});
