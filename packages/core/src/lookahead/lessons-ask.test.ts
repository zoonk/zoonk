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
import { askForLessons, endLessonsAsk } from "./lessons-ask";

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
});
