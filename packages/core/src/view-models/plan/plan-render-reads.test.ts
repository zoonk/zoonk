import { prisma } from "@zoonk/db";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
  plannedSkills,
} from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { countDatabaseRows, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { type readCatchUpItems } from "../../learner/facts/catch-up-items";
import { type readOtherExamGoals } from "../../learner/facts/other-exam-goals";
import { type readOwnedGoal } from "../../learner/facts/owned-goal";
import { type readSavedPlan } from "../../learner/facts/saved-plan";
import { type readActiveSubscription } from "../../learner/facts/subscription";
import { type readTaughtStandInSkills } from "../../learner/facts/taught-stand-in-skills";
import { type readTodayLearnBlocks } from "../../learner/facts/today-learn-blocks";
import { listGoalMindMaps } from "../../mind-maps/list-goal-mind-maps";
import { signedInCourseGoal } from "../_test-utils/course-goal";
import { getProgressView } from "../progress/get-progress-view";
import { getSyllabusView } from "../syllabus/get-syllabus-view";
import { getPlanTabView } from "./get-plan-view";

vi.mock("../../learner/facts/catch-up-items", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readCatchUpItems: typeof readCatchUpItems }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readCatchUpItems: keepRequestReads(actual.readCatchUpItems) };
});

vi.mock("../../learner/facts/subscription", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readActiveSubscription: typeof readActiveSubscription }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readActiveSubscription: keepRequestReads(actual.readActiveSubscription) };
});

vi.mock("../../learner/facts/owned-goal", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readOwnedGoal: typeof readOwnedGoal }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readOwnedGoal: keepRequestReads(actual.readOwnedGoal) };
});

vi.mock("../../learner/facts/saved-plan", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readSavedPlan: typeof readSavedPlan }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readSavedPlan: keepRequestReads(actual.readSavedPlan) };
});

vi.mock("../../learner/facts/other-exam-goals", async (importOriginal) => {
  const [actual, { keepRequestReads }] = await Promise.all([
    importOriginal<{ readOtherExamGoals: typeof readOtherExamGoals }>(),
    import("../../_test-utils/keep-request-reads"),
  ]);

  return { ...actual, readOtherExamGoals: keepRequestReads(actual.readOtherExamGoals) };
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
  it("reads other exams' saved lessons once across subjects and concurrent syllabus readers without writing", async () => {
    const { goal, items, lessons, plan, skills, user } = await signedInCourseGoal();
    const other = await goalFixture({ kind: "exam", userId: user.id });

    await Promise.all([
      prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } }),
      prisma.plan.update({
        data: {
          graph: {
            phases: [{ name: "Physics" }],
            skills: skills.map((skill) => ({
              area: skill.name,
              lessons: 1,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
            })),
          },
        },
        where: { id: plan.id },
      }),
      ...items.map((item, index) =>
        prisma.planItem.update({ data: { skillId: skills[index]!.id }, where: { id: item.id } }),
      ),
      planFixture({
        goalId: other.id,
        items: lessons.map((lesson, index) => ({
          lessonId: lesson.id,
          skillId: skills[index]!.id,
        })),
      }),
    ]);

    const reads = await countDatabaseStatements(() =>
      countDatabaseRows(
        () =>
          Promise.all([getSyllabusView({ goalId: goal.id }), getSyllabusView({ goalId: goal.id })]),
        'FROM "public"."plan_items" LEFT JOIN "public"."library_lessons"',
      ),
    );

    expect(reads.writes).toBe(0);
    expect(reads.result.rows).toBe(lessons.length);

    for (const result of reads.result.result) {
      expect(result).toMatchObject({
        status: "ready",
        syllabus: {
          sharedExams: [{ goalId: other.id }],
          subjects: skills.map((skill) => ({ name: skill.name, sharedWith: [other.id] })),
        },
      });
    }
  });

  it("reads the goal once for the plan", async () => {
    const { goal } = await signedInCourseGoal();

    const reads = await countDatabaseRows(
      () => getPlanTabView({ goalId: goal.id }),
      'WHERE ("public"."goals"."id" = $1 AND "public"."goals"."user_id" = $2)',
    );

    expect(reads.result.status).toBe("ready");
    expect(reads.rows).toBe(1);
  });

  it("reads an exam's subscription and catch-up work once for the plan, its progress and syllabus", async () => {
    const { goal, plan, user } = await signedInCourseGoal();
    const blueprint = await examBlueprintFixture();

    await Promise.all([
      prisma.goal.update({
        data: { examBlueprintId: blueprint.id, kind: "exam" },
        where: { id: goal.id },
      }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
      planChangeFixture({ kind: "resumed", planId: plan.id, status: "applied" }),
    ]);

    const subscriptions = await countDatabaseRows(
      () =>
        countDatabaseRows(
          () =>
            Promise.all([
              getPlanTabView({ goalId: goal.id }),
              getProgressView({ goalId: goal.id }),
              getSyllabusView({ goalId: goal.id }),
            ]),
          '"public"."plan_changes"."kind" IN ($1,$2)',
        ),
      'FROM "public"."subscriptions"',
    );

    const catchUp = subscriptions.result;

    expect(catchUp.result.map((result) => result.status)).toStrictEqual([
      "ready",
      "ready",
      "ready",
    ]);

    expect({ catchUp: catchUp.rows, subscriptions: subscriptions.rows }).toStrictEqual({
      catchUp: 1,
      subscriptions: 1,
    });
  });

  it("reads the saved plan's items once for the plan and its progress", async () => {
    const { items } = await signedInCourseGoal();

    const reads = await countDatabaseRows(
      () => Promise.all([getPlanTabView(), getProgressView()]),
      '"plan_items"',
    );

    expect(reads.result.map((result) => result.status)).toStrictEqual(["ready", "ready"]);
    expect(reads.rows).toBe(items.length);
  });

  it("reads stand-in lessons and today's lessons once for the plan, its syllabus and mind maps", async () => {
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
          () => Promise.all([getPlanTabView(), getSyllabusView(), listGoalMindMaps()]),
          '"public"."courses"."user_id", "public"."courses"."visibility"',
        ),
      'SELECT "public"."study_sessions"."id" FROM',
    );

    const standIns = sessions.result;

    expect(standIns.result.map((result) => result.status)).toStrictEqual([
      "ready",
      "ready",
      "ready",
    ]);

    expect({ sessions: sessions.rows, standIns: standIns.rows }).toStrictEqual({
      sessions: 1,
      standIns: 1,
    });
  });
});
