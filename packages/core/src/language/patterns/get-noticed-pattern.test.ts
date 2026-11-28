import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getNoticedPattern } from "./get-noticed-pattern";

function createPattern({
  goalId,
  kind = "pattern",
  userId,
}: {
  goalId: string;
  kind?: "pattern" | "typos";
  userId: string;
}) {
  return prisma.mistakePattern.create({
    data: {
      content: { contrast: [], drill: [], examples: [], rule: "Use for with durations." },
      goalId,
      kind,
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

    await expect(getNoticedPattern()).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("does not reveal another learner's goal", async () => {
    const [{ goal }, other] = await Promise.all([languageGoalFixture(), userFixture()]);
    mockSession(other.id);

    await expect(getNoticedPattern({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("keeps the no-goal and non-language states", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(getNoticedPattern()).resolves.toStrictEqual({ status: "noGoal" });

    const goal = await goalFixture({ userId: user.id });

    await expect(getNoticedPattern({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notLanguage",
    });
  });

  it("returns a fresh finding of typos too, without writing", async () => {
    const { goal, user } = await languageGoalFixture();
    const typos = await createPattern({ goalId: goal.id, kind: "typos", userId: user.id });
    mockSession(user.id);

    const read = await countDatabaseStatements(() => getNoticedPattern({ goalId: goal.id }));

    expect(read.result).toStrictEqual({
      pattern: { id: typos.id, kind: "typos", title: "since and for" },
      status: "ready",
    });

    expect(read.writes).toBe(0);
  });
});
