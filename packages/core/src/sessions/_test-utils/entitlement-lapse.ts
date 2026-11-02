import { prisma } from "@zoonk/db";
import { plusCallDayFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { expect } from "vitest";
import { mockAccountSession } from "../../_test-utils/mock-session";
import { openStudyDay } from "../open-study-day";
import { SESSION_TODAY } from "./session-goal";

export async function lapsedDayFixture() {
  const user = await userFixture();

  const fixture = await plusCallDayFixture({ localDate: SESSION_TODAY, userId: user.id });
  mockAccountSession({ user });

  const opened = await openStudyDay({
    goalId: fixture.goal.id,
    shownDate: "2026-09-30",
    timeZone: "UTC",
  });

  expect(opened.status).toBe("opened");

  if (opened.status !== "opened") {
    throw new Error("Expected the Plus day");
  }

  expect(opened.session.blocks).toHaveLength(1);
  expect(opened.session.blocks[0]?.planItemId).toBe(fixture.boss.id);

  await prisma.subscription.updateMany({
    data: { status: "canceled" },
    where: { referenceId: user.id },
  });

  return { ...fixture, sessionId: opened.sessionId, user };
}

export async function readLapsedDayState(userId: string) {
  const [user, plans, sessions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.plan.findMany({
      include: { items: { orderBy: { position: "asc" } } },
      where: { goal: { userId } },
    }),
    prisma.studySession.findMany({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { userId },
    }),
  ]);

  return { plans, sessions, user };
}
