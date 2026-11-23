import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { CGU } from "../../exams/mocks/_test-utils/cgu-written";
import { reviewLessonPlanSkills } from "../../lesson-player/_utils/plan-skill-review";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { markPlanItemsTestedOut, markSkillsKnown } from "../_utils/known-skills";
import { loadSkillEvidence } from "../_utils/load-skill-claims";
import { recordLearnerAnswer } from "../record-learner-answer";
import { getChapterTestOut } from "./get-chapter-test-out";
import { submitChapterTestOut } from "./submit-chapter-test-out";

async function writtenChapter(itemsPerSkill: number) {
  const [user, blueprint] = await Promise.all([
    userFixture(),
    examBlueprintFixture({ structure: CGU }),
  ]);

  const fixture = await learnerGoalFixture({ itemsPerSkill, phases: [1], userId: user.id });
  const { goal, plan, skills } = fixture;
  const [written] = skills;

  if (!written) {
    throw new Error("Expected a written skill");
  }

  await Promise.all([
    prisma.goal.update({
      data: { examBlueprintId: blueprint.id, kind: "exam" },
      where: { id: goal.id },
    }),
    prisma.plan.update({
      data: {
        graph: {
          skills: [
            { area: "Writing", lessons: 1, name: written.name, phase: 0, skillId: written.id },
          ],
        },
      },
      where: { id: plan.id },
    }),
  ]);

  mockSession(user.id);
  return { ...fixture, user, written };
}

describe(getChapterTestOut, () => {
  it("reads chapter test-out display without writing", async () => {
    const user = await userFixture();

    const { goal, chapters } = await learnerGoalFixture({
      itemsPerSkill: 2,
      phases: [4, 2],
      userId: user.id,
    });

    mockSession(user.id);

    const counts = await countDatabaseStatements(async () =>
      getChapterTestOut({ chapterId: chapters[0]!.id, goalId: goal.id }),
    );

    expect(counts.writes).toBe(0);
    expect(counts.result.status).toBe("ready");
  });

  it.each([0, 4])(
    "does not offer an objective test for a written chapter with %i questions",
    async (count) => {
      const { goal, chapters, items } = await writtenChapter(count);
      const chapterId = chapters[0]!.id;

      await expect(getChapterTestOut({ chapterId, goalId: goal.id })).resolves.toStrictEqual({
        status: "nothingToSkip",
      });

      await expect(
        submitChapterTestOut({
          chapterId,
          goalId: goal.id,
          input: {
            answers: items.map(({ id: itemId }) => ({
              answer: { selectedIndex: 0 },
              durationMs: 1000,
              itemId,
            })),
            requestId: crypto.randomUUID(),
            timeZone: "UTC",
          },
        }),
      ).resolves.toStrictEqual({ status: "nothingToSkip" });
    },
  );

  it("rejects objective evidence at the attempt, lesson-review, inference and skip write boundaries", async () => {
    const { goal, items, planItems, user, written } = await writtenChapter(1);
    const userId = user.id;
    const skillId = written.id;
    const today = new Date();
    const timeZone = "UTC";

    await recordLearnerAnswer({
      answer: { selectedIndex: 0 },
      graded: { durationMs: 1000, isCorrect: true },
      itemId: items[0]?.id,
      language: goal.language,
      purpose: "learning",
      skillId,
      timeZone,
      userId,
    });

    await expect(
      prisma.$transaction((transaction) =>
        reviewLessonPlanSkills({
          answers: [{ isCorrect: true, skillId: null, stepId: crypto.randomUUID() }],
          planSkillIds: [skillId],
          reviewedAt: today,
          timeZone,
          transaction,
          userId,
        }),
      ),
    ).resolves.toBe(false);

    await markSkillsKnown({ knownAt: today, skillIds: [skillId], timeZone, userId });

    await expect(
      markPlanItemsTestedOut({
        goalId: goal.id,
        items: planItems.map((item) => ({ ...item, skillIds: [skillId] })),
        knownSkillIds: new Set([skillId]),
        testedOutAt: today,
        timeZone,
      }),
    ).resolves.toMatchObject({ planItemIds: [] });

    await expect(
      prisma.learnerSkill.findUnique({ where: { userSkill: { skillId, userId } } }),
    ).resolves.toBeNull();

    await expect(
      prisma.planItem.findUnique({ where: { id: planItems[0]!.id } }),
    ).resolves.toMatchObject({ status: "todo" });

    await expect(
      loadSkillEvidence({ goalId: goal.id, skillIds: [skillId], userId }),
    ).resolves.toMatchObject({ known: new Set() });
  });

  it("names the chapter, for screens opened without it", async () => {
    const user = await userFixture();

    const { goal, chapters } = await learnerGoalFixture({
      itemsPerSkill: 2,
      phases: [4, 2],
      userId: user.id,
    });

    mockSession(user.id);

    const result = await getChapterTestOut({ chapterId: chapters[0]!.id, goalId: goal.id });

    expect(result.status === "ready" && result.testOut.chapterTitle).toBe(chapters[0]!.title);
  });
});
