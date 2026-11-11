import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { type BlockPayload, getBlockItemIds, readBlockPayload } from "../block-payload";
import { withSessionAppendLock } from "./extra-blocks";
import { oweStartedDaySettlements } from "./owe-started-day-settlements";
import { STUDY_SESSION_INCLUDE } from "./study-session-access";

type OpenBlock = { block: StudySessionBlock; payload: BlockPayload };

function listOpenTestBlocks(blocks: readonly StudySessionBlock[]): OpenBlock[] {
  return blocks
    .filter((block) => block.status === "pending" || block.status === "active")
    .map((block) => ({ block, payload: readBlockPayload(block) }))
    .filter(({ payload }) => payload.placementItemIds.length > 0);
}

/** A block left with nothing to ask is skipped, which settles a started day as any skip does. */
async function dropFromBlock({
  answered,
  open: { block, payload },
  tx,
}: {
  answered: ReadonlySet<string | null>;
  open: OpenBlock;
  tx: TransactionClient;
}): Promise<StudySessionBlock | null> {
  const kept = {
    ...payload,
    placementItemIds: payload.placementItemIds.filter((id) => answered.has(id)),
  };

  const empty = getBlockItemIds(kept).length === 0;

  await tx.studySessionBlock.update({
    data: { payload: kept, ...(empty && { status: "skipped" }) },
    where: { id: block.id },
  });

  return empty ? block : null;
}

/**
 * Takes the Focus test's unanswered questions out of the goal's study day, as "Not today" and
 * "Pause test questions" ask. Answered ones stay with their block, and nothing is recorded for the
 * ones removed.
 */
export async function dropSessionTestQuestions({
  goalId,
  localDate,
  userId,
}: {
  goalId: string;
  localDate: Date;
  userId: string;
}): Promise<void> {
  const session = await prisma.studySession.findUnique({
    include: STUDY_SESSION_INCLUDE,
    where: { userGoalDate: { goalId, localDate, userId } },
  });

  if (!session || listOpenTestBlocks(session.blocks).length === 0) {
    return;
  }

  await withSessionAppendLock({
    run: async ({ session: locked, transaction }) => {
      const open = listOpenTestBlocks(locked.blocks);

      const answers = await transaction.attempt.findMany({
        select: { itemId: true },
        where: {
          itemId: { in: open.flatMap(({ payload }) => payload.placementItemIds) },
          studySessionId: locked.id,
        },
      });

      const answered = new Set(answers.map((answer) => answer.itemId));
      const emptied: StudySessionBlock[] = [];

      for (const block of open) {
        // oxlint-disable-next-line no-await-in-loop -- Queries sharing a transaction must finish before the next one starts.
        const skipped = await dropFromBlock({ answered, open: block, tx: transaction });

        if (skipped) {
          emptied.push(skipped);
        }
      }

      await oweStartedDaySettlements(transaction, emptied);
    },
    session,
  });
}
