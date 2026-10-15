import { prisma } from "@zoonk/db";
import { goalFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { listeningGoalFixture, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { mistakeListInputSchema } from "./contract";
import { countGoalMistakes, countOpenGoalMistakes } from "./count-goal-mistakes";
import { listCurrentUserMistakes } from "./list-current-user-mistakes";

const YESTERDAY = new Date("2026-10-14T12:00:00Z");

async function readCounts(goalId: string) {
  const notebook = await countDatabaseStatements(() =>
    listCurrentUserMistakes(mistakeListInputSchema.parse({ goalId, limit: 1, status: "open" })),
  );

  const available = await countDatabaseStatements(() => countGoalMistakes({ goalId }));
  const open = await countDatabaseStatements(() => countOpenGoalMistakes({ goalId }));

  if (
    notebook.result.status !== "ready" ||
    available.result.status !== "ready" ||
    open.result.status !== "ready"
  ) {
    throw new Error("Expected the notebook and both count reads to be ready");
  }

  expect(available.result.availability).toStrictEqual(notebook.result.availability);
  expect(open.result.open).toBe(notebook.result.counts.open);
  assertReadBudget(available, 24);
  assertReadBudget(open, 12);
  expect(available.statements).toBeLessThan(notebook.statements);
  expect(open.statements).toBeLessThan(notebook.statements);

  return { availability: available.result.availability, open: open.result.open };
}

describe("goal mistake counts", () => {
  beforeEach(() => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  });

  it("requires a session before reading either count", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    mockSession(null);

    const result = await countDatabaseStatements(() =>
      Promise.all([
        countGoalMistakes({ goalId: goal.id }),
        countOpenGoalMistakes({ goalId: goal.id }),
      ]),
    );

    expect(result).toStrictEqual({
      result: [{ status: "unauthorized" }, { status: "unauthorized" }],
      statements: 0,
      writes: 0,
    });
  });

  it("hides another learner's goal", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const goal = await goalFixture({ userId: owner.id });
    mockSession(other.id);

    await expect(countGoalMistakes({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(countOpenGoalMistakes({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("counts an open entry without offering practice when no material exists", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [1],
      userId: user.id,
    });

    await mistakeFixture({ createdAt: YESTERDAY, skillId: skills[0]?.id, userId: user.id });
    mockSession(user.id);

    await expect(readCounts(goal.id)).resolves.toStrictEqual({
      availability: { ready: 0, tomorrow: 0 },
      open: 1,
    });
  });

  it("uses the goal's local midnight and excludes fixed, foreign and out-of-scope mistakes", async () => {
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

    await expect(readCounts(goal.id)).resolves.toStrictEqual({
      availability: { ready: 1, tomorrow: 1 },
      open: 2,
    });

    vi.setSystemTime(new Date("2026-10-15T03:00:00Z"));

    await expect(readCounts(goal.id)).resolves.toStrictEqual({
      availability: { ready: 2, tomorrow: 0 },
      open: 2,
    });
  });

  it.each([false, true])(
    "only drills the missed listening recording when it is valid: %s",
    async (valid) => {
      const { blueprint, goal, listeningSkills, plan, user } = await listeningGoalFixture();
      const skillId = listeningSkills[0]!.id;
      await planItemFixture({ planId: plan.id, skillId });
      const set = await listeningSetFixture({ examBlueprintId: blueprint.id });

      const [text, recorded] = await Promise.all([
        itemFixture({ content: choiceItemContent(), skillId }),
        itemFixture({
          content: valid ? choiceItemContent() : { options: [], question: "Broken old recording" },
          examBlueprintId: blueprint.id,
          setId: set.id,
          setPosition: 0,
          skillId,
        }),
        itemFixture({
          content: choiceItemContent(),
          examBlueprintId: blueprint.id,
          setId: set.id,
          setPosition: 1,
          skillId,
        }),
      ]);

      await Promise.all([
        mistakeFixture({ createdAt: YESTERDAY, itemId: text.id, skillId, userId: user.id }),
        mistakeFixture({ createdAt: YESTERDAY, itemId: recorded.id, skillId, userId: user.id }),
        mistakeFixture({ createdAt: YESTERDAY, skillId, userId: user.id }),
      ]);

      mockSession(user.id);

      await expect(readCounts(goal.id)).resolves.toStrictEqual({
        availability: { ready: valid ? 1 : 0, tomorrow: 0 },
        open: 3,
      });
    },
  );

  it.each([false, true])(
    "keeps the notebook's audience exception for the missed item: %s",
    async (kept) => {
      const user = await userFixture();

      const { goal, skills } = await learnerGoalFixture({
        itemsPerSkill: 0,
        phases: [1],
        userId: user.id,
      });

      const skillId = skills[0]!.id;

      await prisma.goal.update({
        data: { details: { field: "medicine" } },
        where: { id: goal.id },
      });

      const item = await itemFixture({ content: choiceItemContent(), field: "law", skillId });

      await mistakeFixture({
        createdAt: YESTERDAY,
        itemId: kept ? item.id : null,
        skillId,
        userId: user.id,
      });

      mockSession(user.id);

      await expect(readCounts(goal.id)).resolves.toStrictEqual({
        availability: { ready: kept ? 1 : 0, tomorrow: 0 },
        open: 1,
      });
    },
  );

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

    await expect(readCounts(goal.id)).resolves.toStrictEqual({
      availability: { ready: 1, tomorrow: 0 },
      open: 1,
    });
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

    await expect(readCounts(goal.id)).resolves.toStrictEqual({
      availability: { ready: 1, tomorrow: 0 },
      open: 1,
    });
  });
});
