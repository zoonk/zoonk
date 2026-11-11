import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { settleSessionDay } from "./_utils/settle-session-day";
import { stopStudySession } from "./stop-study-session";

describe("the plan work a session's first end owes", () => {
  it.each(["complete", "stop"] as const)(
    "owes it once across concurrent %s requests and later completion",
    async (ending) => {
      const user = await userFixture();
      const { goal } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });

      const session = await studySessionFixture({
        goalId: goal.id,
        plannedMinutes: 0,
        userId: user.id,
      });

      const block = await studySessionBlockFixture({
        kind: "practice",
        sessionId: session.id,
        status: ending === "complete" ? "completed" : "pending",
      });

      mockSession(user.id);

      const complete = () =>
        settleSessionDay({ sessionId: session.id, timeZone: "UTC", userId: user.id });

      const end =
        ending === "complete"
          ? complete
          : () => stopStudySession({ input: {}, sessionId: session.id });

      await Promise.all([end(), end()]);

      const owed = await prisma.followUp.findFirstOrThrow({
        where: { key: session.id, kind: "settleSessionPlan", userId: user.id },
      });

      expect(owed).toMatchObject({
        input: { goalId: goal.id, sessionId: session.id, timeZone: "UTC" },
        revision: 0,
      });

      await end();

      await prisma.studySessionBlock.update({
        data: { status: "completed" },
        where: { id: block.id },
      });

      await complete();

      await expect(
        prisma.followUp.findUniqueOrThrow({ where: { id: owed.id } }),
      ).resolves.toStrictEqual(owed);

      await prisma.followUp.delete({ where: { id: owed.id } });
      await complete();
      await stopStudySession({ input: {}, sessionId: session.id });
      await prisma.studySession.update({ data: { status: "active" }, where: { id: session.id } });

      await prisma.studySessionBlock.update({
        data: { status: "pending" },
        where: { id: block.id },
      });

      await stopStudySession({ input: {}, sessionId: session.id });

      await expect(
        prisma.followUp.count({
          where: { key: session.id, kind: "settleSessionPlan", userId: user.id },
        }),
      ).resolves.toBe(0);
    },
  );
});
