import { auth } from "@zoonk/auth";
import { startLanguageConversation } from "@zoonk/core/language/conversations/start";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { onTestFinished, vi } from "vitest";

function cleanupConnections(userId: string) {
  onTestFinished(async () => {
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
