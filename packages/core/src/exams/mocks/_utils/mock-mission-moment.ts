import "server-only";
import { prisma } from "@zoonk/db";
import { io } from "next/cache";
import { type MissionMomentView } from "../../../sessions/completion-contract";
import { joinMissionMoments } from "../../../sessions/missions/join-mission-moments";
import { loadMissionMoment } from "../../../sessions/missions/mission-moment";
import { type MockSitting } from "./owned-mock";

export async function loadMockMissionMoment({
  mock,
  timeZone,
}: {
  mock: MockSitting | null;
  timeZone: string;
}): Promise<MissionMomentView | null> {
  if (mock?.status !== "finished") {
    return null;
  }

  const sectionIds = mock.conditions.sections.flatMap((section) => section.speakingSectionId ?? []);

  const calls =
    sectionIds.length > 0
      ? await prisma.languageConversation.findMany({
          orderBy: { endedAt: "asc" },
          select: { id: true },
          where: { sectionId: { in: sectionIds }, status: "completed", userId: mock.userId },
        })
      : [];

  const sources = [
    ...calls.map((call) => ({ id: call.id, kind: "conversation" })),
    { id: mock.id, kind: "mockExam" },
  ];

  await io();
  const now = new Date();

  const moments = await Promise.all(
    sources.map((source) => loadMissionMoment({ now, source, timeZone, userId: mock.userId })),
  );

  return joinMissionMoments(moments);
}
