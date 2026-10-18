import "server-only";
import { prisma } from "@zoonk/db";
import { io } from "next/cache";
import { type MissionMomentView } from "../../../sessions/completion-contract";
import { joinMissionMoments } from "../../../sessions/missions/join-mission-moments";
import { loadMissionMoment } from "../../../sessions/missions/mission-moment";
import { type MockSitting } from "./owned-mock";

/**
 * What a finished mock did to the day's missions, as settlement recorded it, so every read of its
 * result that day says it (a reload, another tab): its speaking paper's calls, each its own mission
 * source and ended before the mock, then the mock itself, whose block settles as it's handed in.
 * Null before it's over, when it completed none, and once that day is no longer the learner's.
 */
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
