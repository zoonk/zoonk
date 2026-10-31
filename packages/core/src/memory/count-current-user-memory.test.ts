import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockGuestSession, mockSession, mockSessionFailure } from "../_test-utils/mock-session";
import { countCurrentUserMemory } from "./count-current-user-memory";
import { getCurrentUserMemory } from "./get-current-user-memory";

describe(countCurrentUserMemory, () => {
  it("keeps visitors query-free", async () => {
    mockSession(null);

    await expect(countDatabaseStatements(countCurrentUserMemory)).resolves.toStrictEqual({
      result: null,
      statements: 0,
      writes: 0,
    });
  });

  it("returns zero when the learner has no facts or profile", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const count = await countDatabaseStatements(countCurrentUserMemory);

    expect(count.result).toBe(0);
    assertReadBudget(count, 1);
  });

  it.each([false, true])(
    "matches the owned, unexpired list with memory enabled: %s",
    async (enabled) => {
      freezeClock();
      vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

      const [owner, other] = await Promise.all([userFixture(), userFixture()]);

      await Promise.all([
        learningProfileFixture({ memoryEnabled: enabled, userId: owner.id }),
        memoryFactFixture({ userId: owner.id }),
        memoryFactFixture({ expiresAt: new Date("2026-10-16T12:00:00Z"), userId: owner.id }),
        memoryFactFixture({ expiresAt: new Date(), userId: owner.id }),
        memoryFactFixture({ expiresAt: new Date("2026-10-14T12:00:00Z"), userId: owner.id }),
        memoryFactFixture({ status: "deleted", userId: owner.id }),
        memoryFactFixture({ status: "superseded", userId: owner.id }),
        memoryFactFixture({ userId: other.id }),
      ]);

      mockSession(owner.id);

      const full = await countDatabaseStatements(getCurrentUserMemory);
      const count = await countDatabaseStatements(countCurrentUserMemory);

      expect(full.result?.enabled).toBe(enabled);
      expect(count.result).toBe(full.result?.facts.length);
      expect(count.result).toBe(2);
      assertReadBudget(count, 1);
      expect(count.statements).toBeLessThan(full.statements);
    },
  );

  it("supports the same guest reads and propagates session failures", async () => {
    const user = await userFixture();
    await memoryFactFixture({ userId: user.id });
    mockGuestSession(user.id);

    await expect(countCurrentUserMemory()).resolves.toBe(1);

    const failure = new Error("session unavailable");
    mockSessionFailure(failure);

    await expect(countCurrentUserMemory()).rejects.toBe(failure);
  });
});
