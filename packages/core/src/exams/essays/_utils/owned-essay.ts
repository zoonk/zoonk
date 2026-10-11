import "server-only";
import {
  type ExamBlueprint,
  type Goal,
  type Item,
  type StudySessionBlock,
  prisma,
} from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { readBlockPayload } from "../../../sessions/block-payload";
import { getSession } from "../../../users/get-session";
import { type EssayContent, readEssayContent } from "./essay-content";

type OwnedEssay = {
  blueprint: ExamBlueprint | null;
  block: StudySessionBlock;
  content: EssayContent;
  goal: Goal | null;
  item: Item;
  /** The learner-local day of the block's session (UTC midnight). */
  sessionDate: Date;
  sessionId: string;
  userId: string;
};

export type OwnedEssayResult =
  | { owned: OwnedEssay; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * One of the signed-in learner's writing blocks (produce), by its block id, with the essay it
 * asks for and the exam it's graded for. Another learner's block is "not found".
 */
export async function findOwnedEssay(blockId: string): Promise<OwnedEssayResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const block = isUuid(blockId)
    ? await prisma.studySessionBlock.findFirst({
        include: { session: { include: { goal: { include: { examBlueprint: true } } } } },
        where: { id: blockId, kind: "produce", session: { userId } },
      })
    : null;

  const itemId = block ? readBlockPayload(block).itemIds[0] : undefined;
  const item = itemId ? await prisma.item.findUnique({ where: { id: itemId } }) : null;
  const content = readEssayContent(item);

  if (!block || !item || !content) {
    return { status: "notFound" };
  }

  const { session: studySession, ...row } = block;

  return {
    owned: {
      block: row,
      blueprint: studySession.goal?.examBlueprint ?? null,
      content,
      goal: studySession.goal,
      item,
      sessionDate: studySession.localDate,
      sessionId: block.sessionId,
      userId,
    },
    status: "ready",
  };
}
