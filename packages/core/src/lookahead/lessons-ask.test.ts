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
import { askForLessons, endLessonsAsk, followWrittenLessons } from "./lessons-ask";

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
    "REVIEW #2286: a second outline under the same ask still owes its lessons (first outline followed: %s)",
    async (followed) => {
      const [first, second, user] = await Promise.all([
        skillFixture(),
        skillFixture(),
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
          skills: [first, second].map((skill) => ({
            area: "Physics",
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
      await outlineSkill(first);
      const served = await replanWaitingGoal(goal.id);

      if (followed) {
        await followWrittenLessons({ askedAt: served, goalId: goal.id });
      }

      const owed = () =>
        prisma.followUp.findUniqueOrThrow({
          where: { userKindKey: { key: goal.id, kind: "prepareGoalLessons", userId: user.id } },
        });

      const afterFirst = await owed();

      // The second course's outline lands a minute later, inside the ask's window.
      vi.setSystemTime(new Date(WAITING_START.getTime() + 60_000));
      const secondLessons = await outlineSkill(second);
      await replanWaitingGoal(goal.id);

      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });
      const placed = await plannedLessons(plan.id);
      const afterSecond = await owed();

      expect(secondLessons.every((id) => placed.includes(id))).toBe(true);

      expect({ input: afterSecond.input, revision: afterSecond.revision }).toStrictEqual({
        input: { goalId: goal.id, lessonsAskedAt: askedAt },
        revision: afterFirst.revision + 1,
      });
    },
  );

  it("does not end a newer ask when an outline's day follow is replayed", async () => {
    const skill = await skillFixture();
    const { goal, plan } = await waitingGoal(skill);
    const askedAt = await askForLessons({ goalId: goal.id });

    await followWrittenLessons({ askedAt: askedAt ?? 0, goalId: goal.id });

    const newer = new Date(WAITING_START.getTime() + 60_000);
    await askForLessons({ goalId: goal.id, now: newer });
    await followWrittenLessons({ askedAt: askedAt ?? 0, goalId: goal.id });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      lessonsAskedAt: newer,
    });

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });
});
