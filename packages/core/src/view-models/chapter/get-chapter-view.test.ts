import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
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

    await studied({ skillId: skills[2]?.id ?? "", userId: user.id });

    const result = await getChapterView({ chapterId: chapters[1]?.id ?? "" });
    const view = result.status === "ready" ? result.chapter : null;

    expect(view?.chapter).toStrictEqual({
      chapterId: chapters[1]?.id,
      level: "overview",
      position: 2,
      state: "current",
      title: "Inside the atom",
    });

    expect(
      view?.lessons.map((lesson) => [lesson.lessonId, lesson.state, lesson.minutes]),
    ).toStrictEqual([
      [lessons[2]?.id, "done", 7],
      [lessons[3]?.id, "next", 8],
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
