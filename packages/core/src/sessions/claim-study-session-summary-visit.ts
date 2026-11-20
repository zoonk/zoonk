import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import { type StudySessionSummaryVisitInput } from "./summary-visit-contract";

export async function claimStudySessionSummaryVisit({
  input: { visitId },
  sessionId,
}: {
  input: StudySessionSummaryVisitInput;
  sessionId: string;
}): Promise<
  { first: boolean; status: "ready" } | { status: "notFound" | "summaryNotReady" | "unauthorized" }
> {
  const actor = await getSession();

  if (!actor) {
    return { status: "unauthorized" };
  }

  if (!isUuid(sessionId)) {
    return { status: "notFound" };
  }

  const userId = actor.user.id;

  const session = await prisma.studySession.findFirst({
    select: {
      _count: { select: { blocks: true } },
      blocks: { select: { id: true }, take: 1, where: { status: { in: ["active", "pending"] } } },
      localDate: true,
      stoppedAt: true,
    },
    where: { id: sessionId, userId },
  });

  if (!session) {
    return { status: "notFound" };
  }

  const userDate = { localDate: session.localDate, userId };

  const eligible =
    session.stoppedAt !== null || (session._count.blocks > 0 && session.blocks.length === 0);

  const existing = await prisma.studySummaryVisit.findUnique({ where: { userDate } });

  if (existing?.visitId === visitId) {
    return { first: true, status: "ready" };
  }

  if (!eligible) {
    return { status: "summaryNotReady" };
  }

  if (existing) {
    return { first: false, status: "ready" };
  }

  const { count } = await prisma.studySummaryVisit.createMany({
    data: { ...userDate, visitId },
    skipDuplicates: true,
  });

  if (count > 0) {
    return { first: true, status: "ready" };
  }

  const winner = await prisma.studySummaryVisit.findUnique({ where: { userDate } });
  return { first: winner?.visitId === visitId, status: "ready" };
}
