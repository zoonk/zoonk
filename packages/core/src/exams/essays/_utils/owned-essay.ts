import "server-only";
import { type Goal, type Item, type StudySessionBlock, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { readBlockPayload } from "../../../sessions/block-payload";
import { getSession } from "../../../users/get-session";
import { type EssayContent, readEssayContent } from "./essay-content";

type OwnedEssay = {
  block: StudySessionBlock;
  content: EssayContent;
  goal: Goal | null;
  item: Item;
  sessionId: string;
  userId: string;
};

export type OwnedEssayResult =
  | { owned: OwnedEssay; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

export async function findOwnedEssay(blockId: string): Promise<OwnedEssayResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const block = isUuid(blockId)
    ? await prisma.studySessionBlock.findFirst({
        include: { session: { include: { goal: true } } },
        where: { id: blockId, kind: "produce", session: { userId } },
      })
    : null;

  const payload = block ? readBlockPayload(block) : null;
  const itemId = payload?.writing && !payload.writing.admissionId ? undefined : payload?.itemIds[0];
  const item = itemId ? await prisma.item.findUnique({ where: { id: itemId } }) : null;
  const content = readEssayContent(item);

  if (!block || !item || !content) {
    return { status: "notFound" };
  }

  const { session: studySession, ...row } = block;

  return {
    owned: {
      block: row,
      content,
      goal: studySession.goal,
      item,
      sessionId: block.sessionId,
      userId,
    },
    status: "ready",
  };
}
