import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WAITING_START,
  outlineSkill,
  plannedLessons,
  waitingGoal,
} from "../library/curriculum/_test-utils/waiting-goals";
import {
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "../library/identity/_test-utils/identity-mocks";
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
