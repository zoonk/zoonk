import { LIVE_CONVERSATION_MODEL } from "@zoonk/ai/tasks/language/live-conversation-models";
import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { onTestFinished, vi } from "vitest";

function cleanupConnections(userId: string) {
  onTestFinished(async () => {
    await prisma.liveCallConnection.deleteMany({ where: { userId } });
  });
}

export async function authenticatedCallFixture(role: "user" | "admin" = "user") {
  const user = await userFixture({ role });

  const [chapter, goal] = await Promise.all([
    libraryChapterFixture({ language: "pt", targetLanguage: "en" }),
    goalFixture({ kind: "language", language: "pt", targetLanguage: "en", userId: user.id }),
  ]);

  const conversation = await prisma.languageConversation.create({
    data: {
      chapterId: chapter.id,
      goalId: goal.id,
      kind: "practice",
      language: "pt",
      level: "A2",
      liveModel: LIVE_CONVERSATION_MODEL,
      minutes: 1,
      scenario: RENTING_SCENARIO,
      targetLanguage: "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId: user.id,
    },
  });

  const signIn = await auth.api.signInEmail({
    body: { email: user.email, password: user.password },
    returnHeaders: true,
  });

  const cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");

  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }));

  cleanupConnections(user.id);
  return { conversationId: conversation.id, user };
}
