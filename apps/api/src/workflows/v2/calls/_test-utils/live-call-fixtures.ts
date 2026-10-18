import { randomUUID } from "node:crypto";
import { auth } from "@zoonk/auth";
import { startLanguageConversation } from "@zoonk/core/language/conversations/start";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { onTestFinished, vi } from "vitest";

const PROVIDER_STARTED_AGO_MS = 2000;

function cleanupConnections(userId: string) {
  onTestFinished(async () => {
    await prisma.liveCallSlot.deleteMany({ where: { userId } });
    await prisma.liveCallConnection.deleteMany({ where: { userId } });
  });
}

/** Existing request-context harness, with a real Better Auth session and test-owned learner. */
export async function authenticatedCallFixture(role: "user" | "admin" = "user") {
  const user = await userFixture({ role });
  const fixture = await languageGoalFixture({ userId: user.id });

  const signIn = await auth.api.signInEmail({
    body: { email: user.email, password: user.password },
    returnHeaders: true,
  });

  const cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));

  const started = await startLanguageConversation({
    chapterId: fixture.renting.id,
    kind: "practice",
    minutes: 1,
  });

  if (started.status !== "ready") {
    throw new Error(`Call fixture could not start: ${started.status}`);
  }

  cleanupConnections(user.id);
  return { ...fixture, conversationId: started.conversationId, user };
}

/** Recovery needs only a owned ledger and usage record, not scenario generation or auth. */
export async function expiredLiveCallFixture(state: "pending" | "active" | "creating" = "active") {
  const user = await userFixture();
  const conversationId = randomUUID();

  const usage = await prisma.usageRecord.create({
    data: { kind: "conversation", seconds: 60, targetId: conversationId, userId: user.id },
  });

  const connection = await prisma.liveCallConnection.create({
    data: {
      attemptNumber: 1,
      conversationId,
      deadlineAt: new Date(Date.now() - 1000),
      generation: 1,
      heldSeconds: 60,
      liabilityMicros: 100_000,
      providerSessionId: state === "active" ? `provider_${randomUUID()}` : null,
      providerStartedAt:
        state === "pending" ? null : new Date(Date.now() - PROVIDER_STARTED_AGO_MS),
      requestId: randomUUID(),
      reservedMicros: 100_000,
      state,
      usageRecordId: usage.id,
      userId: user.id,
      workflowRunId: "fixture-deadline-run",
    },
  });

  await prisma.liveCallSlot.create({
    data: { connectionId: connection.id, generation: 1, userId: user.id },
  });

  cleanupConnections(user.id);
  return connection;
}
