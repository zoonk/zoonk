import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { claimStudySessionSummaryVisit } from "./claim-study-session-summary-visit";

const FIRST_DAY = new Date("2026-11-19T00:00:00Z");
const NEXT_DAY = new Date("2026-11-20T00:00:00Z");

function claim(sessionId: string, visitId = randomUUID()) {
  return claimStudySessionSummaryVisit({ input: { visitId }, sessionId });
}

async function finishedSession(attrs: Parameters<typeof studySessionFixture>[0]) {
  const session = await studySessionFixture({ status: "completed", ...attrs });
  await studySessionBlockFixture({ sessionId: session.id, status: "completed" });
  return session;
}

describe(claimStudySessionSummaryVisit, () => {
  it("elects one visit across goals on the same local day and replays the winning visit", async () => {
    const user = await userFixture();

    const goals = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const sessions = await Promise.all(
      goals.map((goal) =>
        finishedSession({ goalId: goal.id, localDate: FIRST_DAY, userId: user.id }),
      ),
    );

    const visits = sessions.map(({ id }) => ({ sessionId: id, visitId: randomUUID() }));
    mockSession(user.id);

    const results = await Promise.all(
      visits.map(({ sessionId, visitId }) => claim(sessionId, visitId)),
    );

    expect(results).toContainEqual({ first: true, status: "ready" });
    expect(results).toContainEqual({ first: false, status: "ready" });

    const winner = await prisma.studySummaryVisit.findUniqueOrThrow({
      where: { userDate: { localDate: FIRST_DAY, userId: user.id } },
    });

    await expect(
      Promise.all(visits.map(({ sessionId, visitId }) => claim(sessionId, visitId))),
    ).resolves.toStrictEqual(
      visits.map(({ visitId }) => ({ first: visitId === winner.visitId, status: "ready" })),
    );

    const next = await finishedSession({ localDate: NEXT_DAY, userId: user.id });
    await expect(claim(next.id)).resolves.toStrictEqual({ first: true, status: "ready" });
  });

  it("allows a real stop with remaining work and does not replay the visit after more work", async () => {
    const user = await userFixture();
    const session = await studySessionFixture({ status: "active", userId: user.id });
    const block = await studySessionBlockFixture({ sessionId: session.id });
    mockSession(user.id);

    await expect(claim(session.id)).resolves.toStrictEqual({ status: "summaryNotReady" });

    await prisma.studySession.update({
      data: { stoppedAt: new Date() },
      where: { id: session.id },
    });

    await expect(claim(session.id)).resolves.toStrictEqual({ first: true, status: "ready" });

    await prisma.studySessionBlock.update({
      data: { brainPower: 100, status: "completed" },
      where: { id: block.id },
    });

    await expect(claim(session.id)).resolves.toStrictEqual({ first: false, status: "ready" });
  });

  it("accepts a nonempty queue that was skipped before starting", async () => {
    const user = await userFixture();
    const session = await studySessionFixture({ userId: user.id });
    const visitId = randomUUID();
    mockSession(user.id);

    await expect(claim(session.id, visitId)).resolves.toStrictEqual({ status: "summaryNotReady" });
    await studySessionBlockFixture({ sessionId: session.id, status: "skipped" });

    await expect(claim(session.id, visitId)).resolves.toStrictEqual({
      first: true,
      status: "ready",
    });

    await studySessionBlockFixture({ sessionId: session.id });

    await expect(claim(session.id, visitId)).resolves.toStrictEqual({
      first: true,
      status: "ready",
    });
  });

  it("requires an owned session before recording a visit", async () => {
    const [owner, stranger] = await Promise.all([userFixture(), userFixture()]);
    const session = await finishedSession({ userId: owner.id });

    mockSession(null);
    await expect(claim(session.id)).resolves.toStrictEqual({ status: "unauthorized" });

    mockSession(stranger.id);
    await expect(claim(session.id)).resolves.toStrictEqual({ status: "notFound" });

    mockSession(owner.id);
    await expect(claim(session.id)).resolves.toStrictEqual({ first: true, status: "ready" });
  });
});
