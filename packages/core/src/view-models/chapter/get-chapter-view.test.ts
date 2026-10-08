import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { signedInCourseGoal } from "../_test-utils/course-goal";
import { getChapterView } from "./get-chapter-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

function studied({ skillId, userId }: { skillId: string; userId: string }) {
  return learnerSkillFixture({
    lastReviewedAt: new Date(),
    reps: 1,
    skillId,
    stability: 3,
    state: "learning",
    userId,
  });
}

/** A notice subject with one topic, as an exam's blueprint lists it. */
function noticeSubject(name: string, topic: string) {
  return {
    citation: { passage: "Conteúdo programático", sourceId: "notice" },
    name,
    questions: 10,
    topics: [topic],
    weight: null,
  };
}

/** A skill of the plan's graph, in a subject's area. */
function graphSkill(skill: { id: string; name: string }, area: string) {
  return { area, lessons: 1, name: skill.name, phase: 0, skillId: skill.id };
}

describe(getChapterView, () => {
  it("finds only chapters of the learner's own plan", async () => {
    const { chapters, goal } = await signedInCourseGoal();
    const chapterId = chapters[0]?.id ?? "";

    mockSession(null);
    await expect(getChapterView({ chapterId })).resolves.toStrictEqual({ status: "unauthorized" });

    const other = await userFixture();
    mockSession(other.id);

    await expect(getChapterView({ chapterId, goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(goal.userId);
    const outside = await libraryChapterFixture();

    await expect(getChapterView({ chapterId: outside.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getChapterView({ chapterId: "not-a-chapter" })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("lists the chapter's lessons with the next one to open, its map and its number", async () => {
    const { chapters, lessons, skills, user } = await signedInCourseGoal({
      statuses: ["done", "done", "done", "todo"],
    });

    await Promise.all([
      studied({ skillId: skills[2]?.id ?? "", userId: user.id }),
      prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: lessons[2]?.id } }),
    ]);

    const result = await getChapterView({ chapterId: chapters[1]?.id ?? "" });
    const view = result.status === "ready" ? result.chapter : null;

    expect(view?.chapter).toStrictEqual({
      chapterId: chapters[1]?.id,
      level: "overview",
      position: 2,
      state: "current",
      subject: null,
      title: "Inside the atom",
    });

    // A written lesson says so, so apps load its screens ahead without starting any writing.
    expect(
      view?.lessons.map((lesson) => [
        lesson.lessonId,
        lesson.state,
        lesson.minutes,
        lesson.written,
      ]),
    ).toStrictEqual([
      [lessons[2]?.id, "done", 7, true],
      [lessons[3]?.id, "next", 8, false],
    ]);

    expect(
      view?.skills.map((skill) => [skill.name, skill.state, skill.prerequisiteIds]),
    ).toStrictEqual([
      ["Orbital", "learning", [skills[1]?.id]],
      ["Energy levels", "new", [skills[2]?.id]],
    ]);

    expect(view?.lessons[1]?.skillIds).toStrictEqual([skills[3]?.id]);
    expect(view?.counts).toMatchObject({ learning: 1, new: 1, total: 2 });
  });

  it("numbers a chapter in its subject, as the subject's page lists it", async () => {
    const user = await userFixture();

    const [blueprint, spelling, law, cohesion] = await Promise.all([
      examBlueprintFixture({
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: [
            noticeSubject("Língua Portuguesa", "Ortografia"),
            noticeSubject("Direito Constitucional", "Princípios"),
          ],
        },
      }),
      skillFixture({ name: "Aplicar a ortografia" }),
      skillFixture({ name: "Aplicar os princípios" }),
      skillFixture({ name: "Analisar a coesão" }),
    ]);

    const [goal, spellingChapter, lawChapter, cohesionChapter] = await Promise.all([
      goalFixture({ examBlueprintId: blueprint.id, kind: "exam", userId: user.id }),
      libraryChapterFixture({ title: "Grafia" }),
      libraryChapterFixture({ title: "A Constituição" }),
      libraryChapterFixture({ title: "Coesão" }),
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ name: "Fundamentos" }],
        skills: [
          graphSkill(spelling, "Língua Portuguesa"),
          graphSkill(law, "Direito Constitucional"),
          graphSkill(cohesion, "Língua Portuguesa"),
        ],
      },
    });

    // The plan alternates subjects: cohesion is its third chapter and Portuguese's second.
    const items = [
      { chapter: spellingChapter, day: "2026-10-06", skill: spelling },
      { chapter: lawChapter, day: "2026-10-07", skill: law },
      { chapter: cohesionChapter, day: "2026-10-08", skill: cohesion },
    ];

    await Promise.all(
      items.map((item, position) =>
        planItemFixture({
          chapterId: item.chapter.id,
          planId: plan.id,
          position,
          scheduledFor: new Date(`${item.day}T00:00:00.000Z`),
          skillId: item.skill.id,
        }),
      ),
    );

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    const result = await getChapterView({ chapterId: cohesionChapter.id });
    const view = result.status === "ready" ? result.chapter : null;

    expect(view?.chapter).toMatchObject({
      position: 2,
      subject: { key: "lingua-portuguesa", name: "Língua Portuguesa" },
      title: "Coesão",
    });
  });

  /*
   * An exam plan teaches one skill across chapters, so the map files the skill under the chapter
   * that met it first. The later chapter is still the plan's: its page lists what it teaches.
   */
  it("opens a chapter whose skills were all met in an earlier chapter", async () => {
    const { plan, skills } = await signedInCourseGoal({
      statuses: ["done", "done", "todo", "todo"],
    });

    const atom = skills[0];

    const [chapter, lesson] = await Promise.all([
      libraryChapterFixture({ level: "overview", title: "Atoms again" }),
      libraryLessonFixture({ estimatedMinutes: 4, title: "Atoms in a solid" }),
    ]);

    await Promise.all([
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: atom?.id ?? "" }),
      planItemFixture({
        chapterId: chapter.id,
        lessonId: lesson.id,
        phase: 1,
        planId: plan.id,
        position: 4,
        titleSnapshot: lesson.title,
      }),
    ]);

    const result = await getChapterView({ chapterId: chapter.id });
    const view = result.status === "ready" ? result.chapter : null;

    expect(view?.chapter).toMatchObject({ position: 3, state: "upcoming", title: "Atoms again" });

    expect(view?.lessons.map((item) => [item.lessonId, item.state])).toStrictEqual([
      [lesson.id, "next"],
    ]);

    expect(view?.skills.map((skill) => skill.name)).toStrictEqual(["Atom"]);
  });

  it("counts a chapter item's lessons done once their skills are studied", async () => {
    const { chapters, items, lessons, plan, skills, user } = await signedInCourseGoal();

    await prisma.planItem.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });

    await planItemFixture({
      chapterId: chapters[0]?.id ?? null,
      kind: "chapter",
      phase: 0,
      planId: plan.id,
      position: 0,
    });

    await studied({ skillId: skills[0]?.id ?? "", userId: user.id });

    const result = await getChapterView({ chapterId: chapters[0]?.id ?? "" });
    const view = result.status === "ready" ? result.chapter : null;

    expect(view?.lessons.map((lesson) => [lesson.lessonId, lesson.state])).toStrictEqual([
      [lessons[0]?.id, "done"],
      [lessons[1]?.id, "next"],
    ]);
  });

  it("counts open mistakes on its skills and keeps finished lessons' summary cards", async () => {
    const { chapters, lessons, skills, user } = await signedInCourseGoal({
      statuses: ["done", "todo", "todo", "todo"],
    });

    await Promise.all([
      prisma.lesson.update({
        data: { summary: { ideas: [{ text: "Atoms are mostly empty." }] } },
        where: { id: lessons[0]?.id },
      }),
      prisma.lesson.update({
        data: { summary: { ideas: [{ text: "Not finished yet." }] } },
        where: { id: lessons[1]?.id },
      }),
      mistakeFixture({ skillId: skills[0]?.id, userId: user.id }),
      mistakeFixture({ skillId: skills[1]?.id, userId: user.id }),
      mistakeFixture({ skillId: skills[1]?.id, status: "fixed", userId: user.id }),
      mistakeFixture({ skillId: skills[2]?.id, userId: user.id }),
    ]);

    const result = await getChapterView({ chapterId: chapters[0]?.id ?? "" });
    const view = result.status === "ready" ? result.chapter : null;

    expect(view?.mistakes).toStrictEqual({ open: 2 });

    expect(view?.summaries).toStrictEqual([
      { ideas: ["Atoms are mostly empty."], lessonId: lessons[0]?.id, title: "Lesson about Atom" },
    ]);
  });
});
