import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import {
  SESSION_NOW,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { getChallenge } from "./get-challenge";
import { getCheckpoint } from "./get-checkpoint";

describe("checkpoint render read budgets", () => {
  it("keeps the budget for the due challenge before a session exists and the saved checkpoint", async () => {
    freezeClock();
    vi.setSystemTime(SESSION_NOW);
    const user = await userFixture();
    const fixture = await sessionGoalFixture({ lessons: 3, userId: user.id });
    const [first, second, third] = fixture.planItems;

    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { id: { in: [first!.id, second!.id] } },
    });

    await prisma.planItem.update({ data: { phase: 1, position: 5 }, where: { id: third!.id } });

    const boss = await checkpointItemFixture({
      kind: "boss",
      planId: fixture.plan.id,
      position: 2,
    });

    mockSession(user.id);

    const counts = await countDatabaseStatements(() =>
      getChallenge({ input: {}, planItemId: boss.id }),
    );

    assertReadBudget(counts, 71);
    expect(counts.result.status).toBe("ready");

    await expect(prisma.studySession.count({ where: { goalId: fixture.goal.id } })).resolves.toBe(
      0,
    );

    const today = await getTodayStudySession({ goalId: fixture.goal.id });

    if (today.status !== "ready") {
      throw new Error(today.status);
    }

    const block = today.session.blocks.find((candidate) => candidate.kind === "checkpoint");

    if (!block) {
      throw new Error("Expected a saved checkpoint");
    }

    const saved = await countDatabaseStatements(() => getCheckpoint(block.id));
    assertReadBudget(saved, 20);
    expect(saved.result.status).toBe("ready");
  });
});
