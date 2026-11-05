import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "./_test-utils/open-today";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { getStudyBlock } from "./get-study-block";
import { getStudySession } from "./get-study-session";
import { getStudySessionSummary } from "./get-study-session-summary";

describe("saved session render reads", () => {
  it.each(["display", "block", "summary"] as const)(
    "reads saved session %s without writing",
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
      expect(counts.writes).toBe(0);
      expect(counts.result.status).toBe("ready");
    },
  );
});
