import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { getTodayView } from "../../view-models/today/get-today-view";
import { getTodayPattern } from "./get-today-pattern";

function createPattern({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.mistakePattern.create({
    data: {
      content: { contrast: [], drill: [], examples: [], rule: "Use for with durations." },
      goalId,
      kind: "pattern",
      language: "en",
      model: "test",
      promptVersion: "test",
      runId: "test",
      title: "since and for",
      userId,
    },
  });
}

describe("the notebook's pattern read", () => {
  it("requires a session", async () => {
    mockSession(null);

    await expect(getTodayPattern()).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("does not reveal another learner's goal", async () => {
    const [{ goal }, other] = await Promise.all([languageGoalFixture(), userFixture()]);
    mockSession(other.id);

    await expect(getTodayPattern({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("keeps the no-goal and non-language states", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(getTodayPattern()).resolves.toStrictEqual({ status: "noGoal" });

    const goal = await goalFixture({ userId: user.id });

    await expect(getTodayPattern({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notLanguage",
    });
  });

  it.each([false, true])(
    "matches Today's prompt when covered by the day's mission: %s",
    async (covered) => {
      freezeClock();

      const { goal, user } = await languageGoalFixture();
      const timeZone = goal.timezone ?? "UTC";

      const pattern = await createPattern({ goalId: goal.id, userId: user.id });
      mockSession(user.id);

      if (covered) {
        await studySessionFixture({
          goalId: goal.id,
          localDate: getDateInTimeZone({ date: new Date(), timeZone }),
          missions: {
            picks: [
              {
                anchor: { patternId: pattern.id },
                kind: "pattern",
                opens: { kind: "pattern", patternId: pattern.id },
                total: 1,
              },
            ],
            version: 1,
          },
          startedAt: new Date(),
          userId: user.id,
        });
      }

      const full = await countDatabaseStatements(() => getTodayView({ goalId: goal.id, timeZone }));

      const narrow = await countDatabaseStatements(() => getTodayPattern({ goalId: goal.id }));

      if (full.result.status !== "ready") {
        throw new Error(`Expected Today, got ${full.result.status}`);
      }

      expect(narrow.result).toStrictEqual({ pattern: full.result.today.pattern, status: "ready" });

      assertReadBudget(narrow, covered ? 21 : 6);
      expect(narrow.statements).toBeLessThan(full.statements);

      expect(narrow.result).toMatchObject({ pattern: covered ? null : { id: pattern.id } });
    },
  );
});
