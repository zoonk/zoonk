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

/** A chapter of the course with two lessons, the first tagged with the skill itself. */
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
      // A shared course teaches professionals too: tracing a schematic across sheets in an editor.
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

/** A course chapter in one band, teaching the skill through one lesson. */
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

describe("loadGoalPlannerLessons with the learner's stated level", () => {
  // The level a learner states is a claim: its easier bands stay to confirm, and only placement
  // answers of the skill's own test them out.
  it("keeps a skill's easier band, whatever level the learner says they have", async () => {
    const [user, course, skill] = await Promise.all([
      userFixture(),
      courseFixture({ title: "Constitutional law" }),
      skillFixture({ name: "Read the Constitution's structure" }),
    ]);

    const [basicLesson, levelLesson] = await Promise.all([
      bandChapterOf({ courseId: course.id, level: "beginner", position: 0, skillId: skill.id }),
      bandChapterOf({ courseId: course.id, level: "intermediate", position: 1, skillId: skill.id }),
    ]);

    const goal = {
      details: { level: "intermediate" },
      examBlueprintId: null,
      kind: "learn" as const,
      primaryCourseId: null,
    };

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
