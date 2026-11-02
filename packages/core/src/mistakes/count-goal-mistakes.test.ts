import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession, mockSessionFailure } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { mistakeListInputSchema } from "./contract";
import { countOpenGoalMistakes } from "./count-goal-mistakes";
import { listCurrentUserMistakes } from "./list-current-user-mistakes";

const YESTERDAY = new Date("2026-10-14T12:00:00Z");

async function readCounts(goalId: string) {
  const notebook = await countDatabaseStatements(() =>
    listCurrentUserMistakes(mistakeListInputSchema.parse({ goalId, limit: 1, status: "open" })),
  );

  const open = await countDatabaseStatements(() => countOpenGoalMistakes({ goalId }));

  if (notebook.result.status !== "ready" || open.result.status !== "ready") {
    throw new Error("Expected the notebook and open count to be ready");
  }

  expect(open.result.open).toBe(notebook.result.counts.open);
  assertReadBudget(open, 12);
  expect(open.statements).toBeLessThan(notebook.statements);

  return open.result.open;
}

describe("goal mistake counts", () => {
  beforeEach(() => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  });

  it("requires a session before reading the open count", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    mockSession(null);

    const result = await countDatabaseStatements(() => countOpenGoalMistakes({ goalId: goal.id }));

    expect(result).toStrictEqual({ result: { status: "unauthorized" }, statements: 0, writes: 0 });

    const failure = new Error("session unavailable");
    mockSessionFailure(failure);

    await expect(countOpenGoalMistakes({ goalId: goal.id })).rejects.toBe(failure);
  });

  it("hides another learner's goal", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const goal = await goalFixture({ userId: owner.id });
    mockSession(other.id);

    await expect(countOpenGoalMistakes({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("does not broaden an empty goal scope to all of the learner's mistakes", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    await mistakeFixture({ userId: user.id });
    mockSession(user.id);

    await expect(readCounts(goal.id)).resolves.toBe(0);
  });

  it("counts an open entry even when no practice material exists", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    await mistakeFixture({ createdAt: YESTERDAY, skillId: skills[0]?.id, userId: user.id });
    mockSession(user.id);

    await expect(readCounts(goal.id)).resolves.toBe(1);
  });

  it("keeps open counts across local midnight and excludes fixed, foreign and out-of-scope mistakes", async () => {
    vi.setSystemTime(new Date("2026-10-15T02:30:00Z"));

    const [user, other, elsewhere] = await Promise.all([
      userFixture(),
      userFixture(),
      skillFixture(),
    ]);

    const { goal, skills } = await learnerGoalFixture({ phases: [1], userId: user.id });

    await Promise.all([
      prisma.goal.update({ data: { timezone: "America/Sao_Paulo" }, where: { id: goal.id } }),
      mistakeFixture({
        createdAt: new Date("2026-10-14T02:59:59Z"),
        skillId: skills[0]?.id,
        userId: user.id,
      }),
      mistakeFixture({
        createdAt: new Date("2026-10-14T03:00:00Z"),
        skillId: skills[0]?.id,
        userId: user.id,
      }),
      mistakeFixture({
        createdAt: YESTERDAY,
        skillId: skills[0]?.id,
        status: "fixed",
        userId: user.id,
      }),
      mistakeFixture({ createdAt: YESTERDAY, skillId: skills[0]?.id, userId: other.id }),
      mistakeFixture({ createdAt: YESTERDAY, skillId: elsewhere.id, userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(readCounts(goal.id)).resolves.toBe(2);

    vi.setSystemTime(new Date("2026-10-15T03:00:00Z"));

    await expect(readCounts(goal.id)).resolves.toBe(2);
  });

  it("follows a merged plan skill to its survivor", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    const survivor = await skillFixture();

    await Promise.all([
      prisma.skill.update({ data: { mergedIntoId: survivor.id }, where: { id: skills[0]?.id } }),
      itemFixture({ content: choiceItemContent(), skillId: survivor.id }),
      mistakeFixture({ createdAt: YESTERDAY, skillId: survivor.id, userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(readCounts(goal.id)).resolves.toBe(1);
  });

  it("includes the finer skill taught by a goal lesson", async () => {
    const user = await userFixture();

    const { goal, planItems } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    const [finer, lesson] = await Promise.all([skillFixture(), libraryLessonFixture()]);

    await Promise.all([
      lessonSkillFixture({ lessonId: lesson.id, skillId: finer.id }),
      prisma.planItem.update({ data: { lessonId: lesson.id }, where: { id: planItems[0]?.id } }),
      itemFixture({ content: choiceItemContent(), skillId: finer.id }),
      mistakeFixture({ createdAt: YESTERDAY, skillId: finer.id, userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(readCounts(goal.id)).resolves.toBe(1);
  });
});
