import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "./_test-utils/open-today";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { getStudyBlock } from "./get-study-block";
import { getStudySession } from "./get-study-session";
import { getStudySessionSummary } from "./get-study-session-summary";

describe("render read budgets", () => {
  it.each(["display", "block", "summary"] as const)(
    "keeps the read budget for saved session %s",
    async (name) => {
      freezeClock();
      vi.setSystemTime(SESSION_NOW);
      const user = await userFixture();
      const { goal } = await sessionGoalFixture({ userId: user.id });
      mockSession(user.id);
      const today = await getTodayStudySession({ goalId: goal.id });
      expect(today.status).toBe("ready");

      if (today.status !== "ready") {
        throw new Error(today.status);
      }

      const sessionId = today.session.id;
      const blockId = today.session.blocks[0]!.id;

      const readers = {
        block: () => getStudyBlock({ blockId, sessionId }),
        display: () => getStudySession({ input: {}, sessionId }),
        summary: () => getStudySessionSummary({ input: {}, sessionId }),
      };

      const counts = await countDatabaseStatements<{ status: string }>(readers[name]);
      const budgets = { block: 10, display: 34, summary: 62 };
      assertReadBudget(counts, budgets[name]);
      expect(counts.result.status).toBe("ready");
    },
  );
});
