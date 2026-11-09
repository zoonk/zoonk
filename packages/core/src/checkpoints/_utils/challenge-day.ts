import "server-only";
import { prisma } from "@zoonk/db";
import { hasStoredTimeRunOutAway } from "../../exams/mocks/_utils/owned-mock";
import { type ChallengeBlock } from "./owned-challenge";

/** A mock that expired while away starts again as an unstarted block. */
export async function readTodayBlockStatus({
  isMock,
  todayBlock,
}: {
  isMock: boolean;
  todayBlock: ChallengeBlock | null;
}) {
  if (!isMock || todayBlock?.status !== "active") {
    return todayBlock?.status ?? null;
  }

  const sitting = await prisma.mockExam.findUnique({
    select: {
      answers: { select: { answer: true } },
      conditions: true,
      sectionIndex: true,
      sectionStartedAt: true,
      status: true,
    },
    where: { blockId: todayBlock.id },
  });

  const isOver = !sitting || hasStoredTimeRunOutAway({ mock: sitting, now: Date.now() });
  return isOver ? "pending" : "active";
}
