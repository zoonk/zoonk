import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, suggestedGoalFixture } from "@zoonk/testing/fixtures/goals";
import { memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import { respondToMemoryInsight } from "../../memory/insights/respond-to-memory-insight";
import { respondToSuggestedGoal } from "./respond-to-suggested-goal";

describe("Today card writes", () => {
  it("marks a suggestion answer once, leaving retries and another learner's suggestion unchanged", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    const suggestion = await suggestedGoalFixture({ userId: user.id });
    mockSession(user.id);
    const answer = { input: { status: "accepted" }, suggestionId: suggestion.id } as const;
    await expect(respondToSuggestedGoal(answer)).resolves.toMatchObject({ status: "updated" });

    await expect(respondToSuggestedGoal(answer)).resolves.toMatchObject({
      status: "alreadyAnswered",
    });

    mockSession(other.id);
    await expect(respondToSuggestedGoal(answer)).resolves.toMatchObject({ status: "notFound" });
  });

  it.each(["tip", "scheduleIdea"] as const)(
    "marks a %s answer once and does not change planning inputs",
    async (kind) => {
      const user = await userFixture();
      const goal = await goalFixture({ studyTime: "07:00", userId: user.id });
      const plan = await planFixture({ goalId: goal.id });

      const insight = await memoryInsightFixture({
        goalId: goal.id,
        kind,
        payload: { studyTime: "20:00" },
        userId: user.id,
      });

      mockSession(user.id);
      const answer = { input: { status: "accepted" }, insightId: insight.id } as const;
      await expect(respondToMemoryInsight(answer)).resolves.toMatchObject({ status: "updated" });

      await expect(respondToMemoryInsight(answer)).resolves.toMatchObject({
        status: "alreadyAnswered",
      });

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      ).resolves.toMatchObject({ studyTime: kind === "tip" ? "07:00" : "20:00" });

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({ inputVersion: plan.inputVersion });
    },
  );

  it.each(["suggestion", "insight"] as const)(
    "takes the marker before %s rows and commits one concurrent answer",
    async (kind) => {
      const user = await userFixture();

      const row =
        kind === "suggestion"
          ? await suggestedGoalFixture({ userId: user.id })
          : await memoryInsightFixture({ userId: user.id });

      mockSession(user.id);

      const holder = holdLearnerLock({
        beforeCommit: (tx) =>
          kind === "suggestion"
            ? tx.$queryRaw`SELECT id FROM suggested_goals WHERE id = ${row.id}::uuid FOR UPDATE`
            : tx.$queryRaw`SELECT id FROM memory_insights WHERE id = ${row.id}::uuid FOR UPDATE`,
        userId: user.id,
      });

      const pid = await holder.pid;

      const answer = () =>
        kind === "suggestion"
          ? respondToSuggestedGoal({ input: { status: "dismissed" }, suggestionId: row.id })
          : respondToMemoryInsight({ input: { status: "dismissed" }, insightId: row.id });

      const writes = Promise.all([answer(), answer()]);

      try {
        await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
      } finally {
        holder.release();
        await Promise.all([holder.done, writes]);
      }

      await expect(writes).resolves.toStrictEqual(
        expect.arrayContaining([
          { status: "alreadyAnswered" },
          expect.objectContaining({ status: "updated" }),
        ]),
      );
    },
  );

  it("rolls back an accepting schedule answer that lost to a dismissal while waiting for its marker", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ studyTime: "07:00", userId: user.id });

    const insight = await memoryInsightFixture({
      goalId: goal.id,
      kind: "scheduleIdea",
      payload: { studyTime: "20:00" },
      userId: user.id,
    });

    mockSession(user.id);

    const holder = holdLearnerLock({
      beforeCommit: (tx) =>
        tx.memoryInsight.update({ data: { status: "dismissed" }, where: { id: insight.id } }),
      userId: user.id,
    });

    const pid = await holder.pid;
    const answer = respondToMemoryInsight({ input: { status: "accepted" }, insightId: insight.id });

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      holder.release();
      await Promise.all([holder.done, answer]);
    }

    await expect(answer).resolves.toStrictEqual({ status: "alreadyAnswered" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      studyTime: "07:00",
    });
  });
});
