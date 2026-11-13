import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
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
import { describe, expect, it } from "vitest";
import { loadGoalPlannerLessons } from "../../plans/_utils/planner-lessons";
import {
  approve,
  proposeFix,
  revertFix,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

async function apply(changes: object[]) {
  await signInProposer();
  const fix = await proposeFix({ changes, reason: "Probe." });
  const { key } = await signInApprover();
  const decided = await approve({ fixId: fix.id, key });
  return { decided, fix };
}

describe("content fix regressions", () => {
  it("requires at least one course chapter", async () => {
    const course = await courseFixture();
    const chapter = await libraryChapterFixture();

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      level: "beginner",
      position: 0,
    });

    await signInProposer();

    const decided = await proposeContentFix({
      changes: [{ id: course.id, model: "Course", setChapters: [] }],
      reason: "Keep a chapter.",
    });

    expect({
      chaptersLeft: await prisma.courseChapter.count({ where: { courseId: course.id } }),
      decided: decided.status,
    }).toStrictEqual({ chaptersLeft: 1, decided: "invalid" });
  });

  it("refuses to orphan a lesson that still teaches a skill", async () => {
    const course = await courseFixture();
    const chapter = await libraryChapterFixture({ homeCourseId: course.id });
    const skill = await skillFixture();
    const removed = await libraryLessonFixture({ homeChapterId: chapter.id });
    const kept = await libraryLessonFixture({ homeChapterId: chapter.id });

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      level: "beginner",
      position: 0,
    });

    await chapterLessonFixture({ chapterId: chapter.id, lessonId: removed.id, position: 0 });
    await chapterLessonFixture({ chapterId: chapter.id, lessonId: kept.id, position: 1 });
    await lessonSkillFixture({ lessonId: removed.id, skillId: skill.id });

    const input = {
      goal: { examBlueprintId: null, kind: "learn" as const, primaryCourseId: course.id },
      graph: {
        phases: [{ milestone: null, name: "Learn" }],
        skills: [
          { area: null, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null },
        ],
      },
      userId: null,
    };

    const before = await loadGoalPlannerLessons(input);
    await signInProposer();

    const result = await proposeContentFix({
      changes: [{ id: chapter.id, model: "Chapter", setLessons: [kept.id] }],
      reason: "Remove lesson.",
    });

    expect(result).toMatchObject({ status: "invalid" });
    expect(JSON.stringify(result)).toContain("Lesson.setSkills");
    const after = await loadGoalPlannerLessons(input);

    expect({
      after: after.map((lesson) => lesson.lessonId),
      before: before.map((lesson) => lesson.lessonId),
    }).toStrictEqual({ after: [removed.id], before: [removed.id] });
  });

  it("updates and reverts an exam graph without pinning its timestamp", async () => {
    const course = await courseFixture({ isPublished: true });
    const skill = await skillFixture();
    const blueprint = await examBlueprintFixture({ language: "en" });

    const graph = {
      phases: [{ milestone: null, name: "Learn" }],
      skills: [
        {
          area: null,
          courseIds: [course.id],
          lessons: 1,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    };

    const row = await prisma.examSkillGraph.create({
      data: {
        createdAt: new Date("2026-01-01"),
        examBlueprintId: blueprint.id,
        generatedAt: new Date("2026-01-01"),
        graph,
        model: "test",
        primaryCourseId: course.id,
        promptVersion: "test",
        runId: "test",
        updatedAt: new Date("2026-01-01"),
      },
    });

    const fixed = { ...graph, skills: graph.skills.map((entry) => ({ ...entry, lessons: 2 })) };

    const { decided, fix } = await apply([
      { id: row.id, model: "ExamSkillGraph", setGraph: { graph: fixed } },
    ]);

    const stored = await prisma.examSkillGraph.findUniqueOrThrow({ where: { id: row.id } });

    await signInProposer();
    const inverse = await revertFix({ fixId: fix.id, reason: "Restore graph." });

    expect({
      decided: "fix" in decided ? decided.fix?.status : decided.status,
      inverse: inverse.status,
      lessons: (stored.graph as typeof graph).skills[0]?.lessons,
      primaryCourseKept: stored.primaryCourseId === course.id,
      updatedAtMoved: stored.updatedAt.getTime() > row.updatedAt.getTime(),
    }).toStrictEqual({
      decided: "applied",
      inverse: "proposed",
      lessons: 2,
      primaryCourseKept: true,
      updatedAtMoved: true,
    });
  });

  it.each(["unpublished", "private", "lessons", "name"])(
    "rejects an invalid graph %s independently",
    async (problem) => {
      const draft = await courseFixture({
        isPublished: problem !== "unpublished",
        visibility: problem === "private" ? "private" : "public",
      });

      const skill = await skillFixture();

      const graph = {
        phases: [{ milestone: null, name: "Learn" }],
        skills: [
          {
            area: null,
            courseIds: [draft.id],
            lessons: 1,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          },
        ],
      };

      const row = await prisma.languageSkillGraph.create({
        data: {
          generatedAt: new Date(),
          graph,
          model: "test",
          promptKey: randomUUID(),
          promptVersion: "test",
          runId: "test",
        },
      });

      await signInProposer();

      const result = await proposeContentFix({
        changes: [
          {
            id: row.id,
            model: "LanguageSkillGraph",
            setGraph: {
              graph: {
                ...graph,
                skills: [
                  {
                    ...graph.skills[0],
                    lessons: problem === "lessons" ? 32_768 : 2,
                    name: problem === "name" ? "Not this skill" : skill.name,
                  },
                ],
              },
              primaryCourseId: draft.id,
            },
          },
        ],
        reason: "Probe.",
      });

      expect(result.status).toBe("invalid");
    },
  );
});
