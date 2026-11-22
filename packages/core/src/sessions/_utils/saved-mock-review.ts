import "server-only";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { readBlockPayload } from "../block-payload";
import { isCurrentSession } from "./current-session";
import { planPreparingMockReview } from "./plan-preparing-mock-review";
import { loadPreparingMockPositions } from "./preparing-mock-blocks";
import { followSavedDay } from "./refresh-study-day-selection";
import { lockSessionQueue } from "./session-queue-lock";
import { type StudySessionRow } from "./study-session-access";

type SavedReview = { session: StudySessionRow; timeZone: string; preparing?: ReadonlySet<number> };

function getMockReviewGoal({ session, timeZone }: SavedReview) {
  if (
    session.goal?.kind !== "exam" ||
    session.goal.status !== "active" ||
    session.status === "completed" ||
    !isCurrentSession({ now: new Date(), session, timeZone })
  ) {
    return null;
  }

  const pending = session.blocks.filter(
    (block) => block.status === "pending" || block.status === "active",
  );

  if (
    pending.length === 0 ||
    !pending.every(
      (block) => block.status === "pending" && readBlockPayload(block).checkpoint?.mock,
    )
  ) {
    return null;
  }

  return session.goal;
}

export async function planSavedMockReview(input: SavedReview) {
  const goal = getMockReviewGoal(input);

  if (!goal) {
    return null;
  }

  const { session, timeZone } = input;
  const positions = input.preparing ?? (await loadPreparingMockPositions(session));

  return planPreparingMockReview({
    blocks: session.blocks,
    goal,
    localDate: session.localDate,
    preparing: positions,
    timeZone,
  });
}

export async function persistSavedMockReview(input: SavedReview): Promise<StudySessionRow> {
  if (!getMockReviewGoal(input)) {
    return input.session;
  }

  return writeLearnerChange<StudySessionRow>(
    { userId: input.session.userId },
    async (transaction) => {
      const session = await lockSessionQueue({ sessionId: input.session.id, tx: transaction });

      if (!session) {
        throw new Error("The study session no longer exists.");
      }

      const next = await planSavedMockReview({ session, timeZone: input.timeZone });

      if (!next) {
        return unchanged(session);
      }

      const position = Math.max(-1, ...session.blocks.map((block) => block.position)) + 1;

      const block = await transaction.studySessionBlock.create({
        data: { ...next, position, sessionId: session.id },
      });

      const saved = await transaction.studySession.update({
        data: { plannedMinutes: { increment: next.estimatedMinutes } },
        where: { id: session.id },
      });

      return { ...session, ...saved, blocks: [...session.blocks, block] };
    },
  );
}

export async function openSavedDay({ session, timeZone }: SavedReview) {
  const refilled = await persistSavedMockReview({ session, timeZone });
  return followSavedDay({ session: refilled, timeZone });
}
