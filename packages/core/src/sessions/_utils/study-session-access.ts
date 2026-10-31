import "server-only";
import { type Goal, type StudySession, type StudySessionBlock, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";

export type StudySessionRow = StudySession & { blocks: StudySessionBlock[]; goal: Goal | null };

export type OwnedStudySession =
  | { session: StudySessionRow; status: "ready"; userId: string }
  | { status: "notFound" }
  | { status: "unauthorized" };

export const STUDY_SESSION_INCLUDE = {
  blocks: { orderBy: { position: "asc" } },
  goal: true,
} as const;

/** Internal: `userId` must come from a session or a learner's own write, never from a client. */
export async function findStudySessionFor({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}): Promise<Exclude<OwnedStudySession, { status: "unauthorized" }>> {
  const row = isUuid(sessionId)
    ? await prisma.studySession.findFirst({
        include: STUDY_SESSION_INCLUDE,
        where: { id: sessionId, userId },
      })
    : null;

  return row ? { session: row, status: "ready", userId } : { status: "notFound" };
}

/** Requires sign-in and ownership; other learners' session ids return not-found without revealing existence. */
export async function findOwnedStudySession(sessionId: string): Promise<OwnedStudySession> {
  const session = await getSession();

  return session
    ? findStudySessionFor({ sessionId, userId: session.user.id })
    : { status: "unauthorized" };
}

export type OwnedStudyBlock =
  | { block: StudySessionBlock; session: StudySessionRow; status: "ready"; userId: string }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Requires sign-in and ownership of both the session and its block. */
export async function findOwnedStudyBlock({
  blockId,
  sessionId,
}: {
  blockId: string;
  sessionId: string;
}): Promise<OwnedStudyBlock> {
  const owned = await findOwnedStudySession(sessionId);

  if (owned.status !== "ready") {
    return owned;
  }

  const block = owned.session.blocks.find((candidate) => candidate.id === blockId);

  return block
    ? { block, session: owned.session, status: "ready", userId: owned.userId }
    : { status: "notFound" };
}
