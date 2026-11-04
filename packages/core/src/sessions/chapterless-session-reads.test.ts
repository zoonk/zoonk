import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { toUTCMidnight } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { toBlockPayload } from "./block-payload";
import { getStudySession } from "./get-study-session";

describe("a session's render reads", () => {
  it("reads no plan graph for a session whose blocks offer no chapter test", async () => {
    freezeClock();
    vi.setSystemTime(SESSION_NOW);
    const user = await userFixture();
    const { goal, skills } = await sessionGoalFixture({ userId: user.id });
    const survivor = await skillFixture();

    const [session] = await Promise.all([
      studySessionFixture({
        goalId: goal.id,
        localDate: toUTCMidnight(SESSION_NOW),
        status: "active",
        userId: user.id,
      }),
      prisma.skill.update({ data: { mergedIntoId: survivor.id }, where: { id: skills[0]?.id } }),
    ]);

    await studySessionBlockFixture({
      kind: "review",
      payload: toBlockPayload({ capsules: [] }),
      sessionId: session.id,
    });

    mockSession(user.id);

    const reads = await countDatabaseRows(
      () => getStudySession({ input: {}, sessionId: session.id }),
      '"merged_into_id" IS NOT NULL',
    );

    expect(reads.result.status).toBe("ready");
    expect(reads.rows).toBe(0);
  });
});
