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

/**
 * Resolves one of the signed-in learner's study sessions. Another learner's session is "not
 * found", so session ids never reveal whether a session exists.
 */
export async function findOwnedStudySession(sessionId: string): Promise<OwnedStudySession> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(sessionId)) {
    return { status: "notFound" };
  }

  const row = await prisma.studySession.findFirst({
    include: STUDY_SESSION_INCLUDE,
    where: { id: sessionId, userId: session.user.id },
  });

  return row ? { session: row, status: "ready", userId: session.user.id } : { status: "notFound" };
}

export type OwnedStudyBlock =
  | { block: StudySessionBlock; session: StudySessionRow; status: "ready"; userId: string }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Resolves one block of one of the signed-in learner's sessions. */
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
