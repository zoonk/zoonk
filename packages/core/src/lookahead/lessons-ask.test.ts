import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WAITING_START,
  outlineSkill,
  plannedLessons,
  waitingGoal,
} from "../library/curriculum/_test-utils/waiting-goals";
import { replanWaitingGoal } from "../library/curriculum/replan-waiting-goals";
import {
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "../library/identity/_test-utils/identity-mocks";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getDayOutlines } from "../sessions/_utils/outlining-stand-ins";
import { askForLessons, endLessonsAsk, followWrittenLessons } from "./lessons-ask";
import { OUTLINE_STALE_AFTER_MS } from "./outline-ahead";
import { listDayStandIns } from "./outline-window";

describe(endLessonsAsk, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WAITING_START);
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("brings in the day's lessons written since the plan was saved when the ask finds nothing to write", async () => {
    const [skill, course] = await Promise.all([skillFixture(), courseFixture()]);
    const { goal, plan } = await waitingGoal(skill);

    await prisma.goal.update({ data: { primaryCourseId: course.id }, where: { id: goal.id } });

    const lessons = await outlineSkill(skill);
    const askedAt = await askForLessons({ goalId: goal.id });

    await expect(plannedLessons(plan.id)).resolves.toStrictEqual([skill.id]);

    await endLessonsAsk({ askedAt: askedAt ?? 0, goalId: goal.id, startedCourseIds: [] });

    await expect(plannedLessons(plan.id)).resolves.toStrictEqual(lessons);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      lessonsAskedAt: null,
    });
  });

  it.each([false, true])(
    "a second outline under the same ask still owes its lessons (first outline followed: %s)",
    async (followed) => {
      const [first, second, firstCourse, secondCourse, user] = await Promise.all([
        skillFixture(),
        skillFixture(),
        courseFixture({ outlineStatus: "running" }),
        courseFixture({ outlineStatus: "running" }),
        userFixture(),
      ]);

      const goal = await goalFixture({
        details: { answered: ["purpose", "level", "targetDate", "buddy", "placement", "schedule"] },
        userId: user.id,
      });

      await prisma.plan.create({
        data: {
          goalId: goal.id,
          settings: { startDate: WAITING_START.toISOString().slice(0, 10) },
        },
      });

      // A day that waits on two courses' outlines, both started by the learner's one ask.
      await createGoalPlan({
        goalId: goal.id,
        graph: {
          phases: [{ milestone: null, name: "Phase" }],
          skills: [first, second].map((skill, index) => ({
            area: "Physics",
            courseIds: [index === 0 ? firstCourse.id : secondCourse.id],
            lessons: 2,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            weight: null,
          })),
        },
      });

      const askedAt = await askForLessons({ goalId: goal.id });

      // The first course's outline lands: `replanAndFollow` in replan-waiting-goals.ts.
      await outlineSkill(first, { course: firstCourse });

      await prisma.course.update({
        data: { outlineStatus: "completed" },
        where: { id: firstCourse.id },
      });

      const served = await replanWaitingGoal(goal.id);

      if (followed) {
        await followWrittenLessons({ askedAt: served, goalId: goal.id });
      }

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      ).resolves.toMatchObject({ lessonsAskedAt: new Date(askedAt ?? 0) });

      const owed = () =>
        prisma.followUp.findUniqueOrThrow({
          where: { userKindKey: { key: goal.id, kind: "prepareGoalLessons", userId: user.id } },
        });

      const afterFirst = await owed();

      // The second course's outline lands a minute later, inside the ask's window.
      vi.setSystemTime(new Date(WAITING_START.getTime() + 60_000));
      const secondLessons = await outlineSkill(second, { course: secondCourse });

      await prisma.course.update({
        data: { outlineStatus: "completed" },
        where: { id: secondCourse.id },
      });

      await replanWaitingGoal(goal.id);

      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
      const placed = await plannedLessons(plan.id);
      const afterSecond = await owed();

      expect(secondLessons.every((id) => placed.includes(id))).toBe(true);

      expect({ input: afterSecond.input, revision: afterSecond.revision }).toStrictEqual({
        input: { goalId: goal.id, lessonsAskedAt: askedAt },
        revision: afterFirst.revision + 1,
      });

      await followWrittenLessons({ askedAt, goalId: goal.id });

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
      ).resolves.toMatchObject({ lessonsAskedAt: null });
    },
  );

  it.each(["completed", "failed"] as const)(
    "waits for a new ask's outline after an older outline %s",
    async (outlineStatus) => {
      const [skill, course] = await Promise.all([
        skillFixture(),
        courseFixture({ outlineStatus, updatedAt: new Date(WAITING_START.getTime() - 1) }),
      ]);

      const { goal, plan } = await waitingGoal(skill);

      const ownedGoal = await prisma.goal.update({
        data: { primaryCourseId: course.id },
        where: { id: goal.id },
      });

      const day = { goal: ownedGoal, localDate: new Date("2020-09-28T00:00:00Z") };
      const askedAt = await askForLessons({ goalId: goal.id });
      const input = { askedAt: askedAt ?? 0, goalId: goal.id };

      await endLessonsAsk({ ...input, startedCourseIds: [course.id] });
      await followWrittenLessons(input);

      await expect(getDayOutlines(day)).resolves.toBe("awaiting");

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({ lessonsAskedAt: WAITING_START });

      await prisma.course.update({
        data: { outlineStatus, updatedAt: WAITING_START },
        where: { id: course.id },
      });

      await expect(getDayOutlines(day)).resolves.toBe("idle");
      await followWrittenLessons(input);

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({ lessonsAskedAt: null });
    },
  );

  it("ends a fresh ask's wait only after every course the day needs has ended", async () => {
    const [first, second, firstCourse, secondCourse] = await Promise.all([
      skillFixture(),
      skillFixture(),
      courseFixture({ outlineStatus: "completed", updatedAt: WAITING_START }),
      courseFixture({ outlineStatus: "failed", updatedAt: new Date(WAITING_START.getTime() - 1) }),
    ]);

    const { goal } = await waitingGoal(first);

    await createGoalPlan({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Phase" }],
        skills: [first, second].map((skill, index) => ({
          area: "Physics",
          courseIds: [index === 0 ? firstCourse.id : secondCourse.id],
          lessons: 2,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
    });

    const askedAt = await askForLessons({ goalId: goal.id });

    const input = {
      askedAt: askedAt ?? 0,
      goalId: goal.id,
      startedCourseIds: [firstCourse.id, secondCourse.id],
    };

    const day = { goal, localDate: new Date("2020-09-28T00:00:00Z") };

    await endLessonsAsk(input);
    await expect(getDayOutlines(day)).resolves.toBe("awaiting");

    await prisma.course.update({
      data: { outlineStatus: "failed", updatedAt: new Date(WAITING_START.getTime() + 1) },
      where: { id: secondCourse.id },
    });

    await expect(getDayOutlines(day)).resolves.toBe("idle");
    await endLessonsAsk(input);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ lessonsAskedAt: null });
  });

  it("stops waiting on an expired ask whose outline never started", async () => {
    const [skill, course] = await Promise.all([skillFixture(), courseFixture()]);
    const { goal } = await waitingGoal(skill);

    const ownedGoal = await prisma.goal.update({
      data: { primaryCourseId: course.id },
      where: { id: goal.id },
    });

    const askedAt = await askForLessons({ goalId: goal.id });
    const day = { goal: ownedGoal, localDate: new Date("2020-09-28T00:00:00Z") };

    await expect(getDayOutlines(day)).resolves.toBe("awaiting");
    vi.setSystemTime(new Date(WAITING_START.getTime() + OUTLINE_STALE_AFTER_MS));

    await expect(getDayOutlines(day)).resolves.toBe("idle");
    await followWrittenLessons({ askedAt, goalId: goal.id });

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } }),
    ).resolves.toMatchObject({ lessonsAskedAt: null });
  });

  it.each(["completed", "failed"] as const)(
    "ends the ask when today's unwritten lessons belong to a %s outline",
    async (outlineStatus) => {
      const [skill, course] = await Promise.all([skillFixture(), courseFixture({ outlineStatus })]);
      const { goal, plan } = await waitingGoal(skill);

      await prisma.goal.update({ data: { primaryCourseId: course.id }, where: { id: goal.id } });

      const askedAt = await askForLessons({ goalId: goal.id });

      await endLessonsAsk({
        askedAt: askedAt ?? 0,
        goalId: goal.id,
        startedCourseIds: [course.id],
      });

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({ lessonsAskedAt: null });

      const nextAsk = await askForLessons({ goalId: goal.id });
      await followWrittenLessons({ askedAt: nextAsk, goalId: goal.id });

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({ lessonsAskedAt: null });

      await expect(
        listDayStandIns({ goalId: goal.id, localDate: new Date("2020-09-28T00:00:00Z") }),
      ).resolves.not.toHaveLength(0);
    },
  );

  it("does not end a newer ask when an outline's day follow is replayed", async () => {
    const skill = await skillFixture();
    const { goal, plan } = await waitingGoal(skill);
    const askedAt = await askForLessons({ goalId: goal.id });

    await outlineSkill(skill);
    await replanWaitingGoal(goal.id);
    await followWrittenLessons({ askedAt: askedAt ?? 0, goalId: goal.id });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      lessonsAskedAt: null,
    });

    const newer = new Date(WAITING_START.getTime() + 60_000);
    await askForLessons({ goalId: goal.id, now: newer });
    await followWrittenLessons({ askedAt: askedAt ?? 0, goalId: goal.id });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      lessonsAskedAt: newer,
    });

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });
});
