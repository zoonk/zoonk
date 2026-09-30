import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../../learner/_test-utils/learner-goal";
import { getContentView } from "./get-content-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

async function setup() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 1, phases: [2, 1], userId: user.id });
  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });
  mockSession(user.id);
  return { ...fixture, user };
}

describe(getContentView, () => {
  it("requires a session, an own goal, and says when there's no goal yet", async () => {
    const { goal } = await setup();

    mockSession(null);
    await expect(getContentView()).resolves.toStrictEqual({ status: "unauthorized" });

    const other = await userFixture();
    mockSession(other.id);

    await expect(getContentView({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getContentView()).resolves.toStrictEqual({ status: "noGoal" });
  });

  it("groups the active goal's skills as cards by chapter, in plan order, with counts", async () => {
    const { chapters, skills, user } = await setup();

    await learnerSkillFixture({
      lastReviewedAt: new Date(),
      recallDays: 3,
      reps: 4,
      skillId: skills[1]?.id ?? "",
      stability: 30,
      state: "mastered",
      userId: user.id,
    });

    const result = await getContentView();
    const content = result.status === "ready" ? result.content : null;

    expect(content?.counts).toMatchObject({ mastered: 1, new: 2, total: 3 });

    expect(content?.groups.map((group) => group.areaId)).toStrictEqual(
      chapters.map((chapter) => chapter.id),
    );

    expect(content?.groups[0]?.counts).toMatchObject({ mastered: 1, total: 2 });

    expect(content?.groups[0]?.cards.map((card) => [card.name, card.state])).toStrictEqual([
      ["Skill 1", "new"],
      ["Skill 2", "mastered"],
    ]);

    expect(content?.reveal).toStrictEqual({ cards: false });
  });

  it("puts chapters under the course or subject their skills belong to, each subject together", async () => {
    const user = await userFixture();

    const { chapters, plan, skills } = await learnerGoalFixture({
      itemsPerSkill: 1,
      phases: [1, 1, 1],
      userId: user.id,
    });

    mockSession(user.id);
    const subjects = ["Math", "Science", "Math"];

    await prisma.plan.update({
      data: {
        graph: {
          phases: [],
          skills: skills.map((skill, index) => ({
            area: subjects[index],
            lessons: 1,
            name: skill.name,
            phase: index,
            skillId: skill.id,
          })),
        },
      },
      where: { id: plan.id },
    });

    const result = await getContentView({ goalId: plan.goalId });
    const content = result.status === "ready" ? result.content : null;

    expect(content?.groups.map((group) => [group.section, group.areaId])).toStrictEqual([
      ["Math", chapters[0]?.id],
      ["Math", chapters[2]?.id],
      ["Science", chapters[1]?.id],
    ]);
  });

  it("keeps every finished lesson's summary card, newest first", async () => {
    const { plan, user } = await setup();

    const [older, newer, noSummary] = await Promise.all([
      libraryLessonFixture({
        summary: { ideas: [{ text: "Older idea." }] },
        title: "Older lesson",
      }),
      libraryLessonFixture({
        summary: { ideas: [{ text: "Newer idea." }] },
        title: "Newer lesson",
      }),
      libraryLessonFixture({ title: "No summary yet" }),
    ]);

    await Promise.all([
      planItemFixture({
        completedAt: new Date(Date.now() - MS_PER_DAY),
        lessonId: older.id,
        planId: plan.id,
        position: 10,
        status: "done",
      }),
      planItemFixture({
        completedAt: new Date(),
        lessonId: newer.id,
        planId: plan.id,
        position: 11,
        status: "done",
      }),
      planItemFixture({
        completedAt: new Date(),
        lessonId: noSummary.id,
        planId: plan.id,
        position: 12,
        status: "done",
      }),
      learningEventFixture({ kind: "review", userId: user.id }),
    ]);

    const result = await getContentView();
    const content = result.status === "ready" ? result.content : null;

    expect(content?.summaries.map((summary) => [summary.title, summary.ideas])).toStrictEqual([
      ["Newer lesson", ["Newer idea."]],
      ["Older lesson", ["Older idea."]],
    ]);

    expect(content?.reveal).toStrictEqual({ cards: true });
  });
});
