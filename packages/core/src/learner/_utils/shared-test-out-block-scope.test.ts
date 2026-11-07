import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { loadGoalPlan } from "./goal-skill-graph";
import { markPlanItemsTestedOut } from "./known-skills";

const NOW = new Date("2020-09-28T12:00:00Z");

describe("test-out block scope across goals", () => {
  it("keeps another goal's block for a lesson whose plan item there stays open", async () => {
    const [user, assessed, unassessed, broad] = await Promise.all([
      userFixture(),
      skillFixture(),
      skillFixture(),
      libraryLessonFixture(),
    ]);

    await Promise.all([
      lessonSkillFixture({ lessonId: broad.id, skillId: assessed.id }),
      lessonSkillFixture({ lessonId: broad.id, skillId: unassessed.id }),
    ]);

    const [sourceGoal, otherGoal] = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const [source, other] = await Promise.all([
      planFixture({ goalId: sourceGoal.id }),
      planFixture({ goalId: otherGoal.id }),
    ]);

    // The source goal teaches only `assessed` with this lesson; the other goal needs the whole lesson.
    const [sourceItem, otherItem] = await Promise.all([
      planItemFixture({ lessonId: broad.id, planId: source.id, skillId: assessed.id }),
      planItemFixture({ lessonId: broad.id, planId: other.id }),
    ]);

    const day = await studySessionFixture({
      goalId: otherGoal.id,
      startedAt: NOW,
      status: "active",
      userId: user.id,
    });

    const pending = await studySessionBlockFixture({ lessonId: broad.id, sessionId: day.id });
    const sourcePlan = await loadGoalPlan(sourceGoal.id);

    await markPlanItemsTestedOut({
      followToday: false,
      goalId: sourceGoal.id,
      items: sourcePlan.items,
      knownSkillIds: new Set([assessed.id]),
      testedOutAt: NOW,
      timeZone: "UTC",
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: sourceItem.id } }),
    ).resolves.toMatchObject({ status: "testedOut" });

    // Passing one topic must not complete the other goal's broader lesson...
    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: otherItem.id } }),
    ).resolves.toMatchObject({ status: "todo" });

    // ...so that goal's saved day keeps teaching it.
    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: pending.id } }),
    ).resolves.toMatchObject({ status: "pending" });
  });
});
