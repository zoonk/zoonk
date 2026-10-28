import { type LanguageConversation, type LiveCallConnection, prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { onTestFinished, vi } from "vitest";
import { getSession } from "../../../users/get-session";

export async function liveCallFixture({
  kind = "practice",
  minutes = 2,
  plus = false,
  role = "user",
}: {
  kind?: LanguageConversation["kind"];
  minutes?: number;
  plus?: boolean;
  role?: "user" | "admin";
} = {}) {
  const user = await userFixture({ role });
  const conversation = await anotherLiveConversation({ kind, minutes, userId: user.id });

  if (plus) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  onTestFinished(async () => {
    await prisma.liveCallConnection.deleteMany({ where: { userId: user.id } });
  });

  return { conversation, user };
}

export function anotherLiveConversation({
  kind = "practice",
  minutes = 2,
  userId,
}: {
  kind?: LanguageConversation["kind"];
  minutes?: number;
  userId: string;
}) {
  return prisma.languageConversation.create({
    data: {
      kind,
      language: "pt",
      level: kind === "examSpeaking" ? "B2" : "A2",
      minutes,
      scenario:
        kind === "examSpeaking"
          ? {
              ...RENTING_SCENARIO,
              examTask: {
                card: {
                  instructions: ["Compare las propuestas."],
                  photos: [],
                  prompts: ["Alquilar una habitación", "Compartir un piso"],
                  summary: "Compare the renting proposals.",
                  table: null,
                  text: null,
                },
                exam: "dele",
                level: "B2",
                task: "t1",
              },
            }
          : RENTING_SCENARIO,
      targetLanguage: kind === "examSpeaking" ? "es" : "en",
      titleSnapshot: RENTING_SCENARIO.title,
      userId,
    },
  });
}

export function liveCallHistoryFixture({
  conversationId,
  userId,
  ...attrs
}: Partial<LiveCallConnection> & Pick<LiveCallConnection, "conversationId" | "userId">) {
  return prisma.liveCallConnection.create({
    data: {
      conversationId,
      costMicros: 0,
      createdAt: new Date(),
      deadlineAt: new Date(),
      endedAt: new Date(),
      heldSeconds: 0,
      state: "ended",
      userId,
      ...attrs,
    },
  });
}

export function mockLiveCallAdminSession(user: { id: string; role: string | null }): void {
  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The existing core auth boundary reads identity and role; the fixture avoids duplicating Better Auth's session internals.
    { user: { id: user.id, role: user.role } } as Awaited<ReturnType<typeof getSession>>,
  );
}
