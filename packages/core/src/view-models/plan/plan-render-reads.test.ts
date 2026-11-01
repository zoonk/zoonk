import { prisma } from "@zoonk/db";
import { planItemFixture, plannedSkills } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { type readSavedPlan } from "../../learner/facts/saved-plan";
import { type readTaughtStandInSkills } from "../../learner/facts/taught-stand-in-skills";
import { type readTodayLearnBlocks } from "../../learner/facts/today-learn-blocks";
import { signedInCourseGoal } from "../_test-utils/course-goal";
import { getProgressView } from "../progress/get-progress-view";
import { getSyllabusView } from "../syllabus/get-syllabus-view";
import { getPlanTabView } from "./get-plan-view";

vi.mock("../../learner/facts/saved-plan", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readSavedPlan: typeof readSavedPlan }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readSavedPlan: keepRequestReads(actual.readSavedPlan) };
});

vi.mock("../../learner/facts/taught-stand-in-skills", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readTaughtStandInSkills: typeof readTaughtStandInSkills }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readTaughtStandInSkills: keepRequestReads(actual.readTaughtStandInSkills) };
});

vi.mock("../../learner/facts/today-learn-blocks", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readTodayLearnBlocks: typeof readTodayLearnBlocks }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readTodayLearnBlocks: keepRequestReads(actual.readTodayLearnBlocks) };
});

describe("the Plan's render reads", () => {
  it("reads the saved plan's items once for the plan and its progress", async () => {
    const { items } = await signedInCourseGoal();

    const reads = await countDatabaseRows(
      () => Promise.all([getPlanTabView(), getProgressView()]),
      '"plan_items"',
    );

    expect(reads.result.map((result) => result.status)).toStrictEqual(["ready", "ready"]);
    expect(reads.rows).toBe(items.length);
  });

  it("reads stand-in lessons and today's lessons once for the plan and its syllabus", async () => {
    const { goal, plan, user } = await signedInCourseGoal();
    const skill = await skillFixture({ name: "Spin" });

    await Promise.all([
      prisma.plan.update({
        data: { graph: { skills: plannedSkills([skill]) } },
        where: { id: plan.id },
      }),
      planItemFixture({
        kind: "lesson",
        planId: plan.id,
        position: 10,
        skillId: skill.id,
        titleSnapshot: skill.name,
      }),
      studySessionFixture({ goalId: goal.id, userId: user.id }).then((session) =>
        studySessionBlockFixture({ sessionId: session.id }),
      ),
    ]);

    const sessions = await countDatabaseRows(
      () =>
        countDatabaseRows(
          () => Promise.all([getPlanTabView(), getSyllabusView()]),
          '"public"."courses"."user_id", "public"."courses"."visibility"',
        ),
      'SELECT "public"."study_sessions"."id" FROM',
    );

    const standIns = sessions.result;

    expect(standIns.result.map((result) => result.status)).toStrictEqual(["ready", "ready"]);

    expect({ sessions: sessions.rows, standIns: standIns.rows }).toStrictEqual({
      sessions: 1,
      standIns: 1,
    });
  });
});
