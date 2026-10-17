import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const RECENT_SESSIONS = 14;

/**
 * The learner's latest study sessions (one per goal and day) with how many blocks they finished
 * and the Brain Power they earned, read from the blocks so no content is joined.
 */
export const listUserStudySessions = cacheAdminData((userId: string) =>
  prisma.studySession.findMany({
    include: {
      blocks: {
        orderBy: { position: "asc" },
        select: { brainPower: true, kind: true, status: true },
      },
      goal: { select: { id: true, title: true } },
    },
    omit: { endSnapshot: true, startSnapshot: true },
    orderBy: [{ localDate: "desc" }, { createdAt: "desc" }],
    take: RECENT_SESSIONS,
    where: { userId },
  }),
);

export type UserStudySession = Awaited<ReturnType<typeof listUserStudySessions>>[number];
