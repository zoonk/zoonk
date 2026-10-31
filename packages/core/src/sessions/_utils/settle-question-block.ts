import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import {
  type CheckpointOutcome,
  getCheckpointOutcome,
  isBlockDuelDecided,
} from "../../checkpoints/_utils/checkpoint-outcome";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { recordLearningEvent } from "../../stats/record-learning-event";
import { type BlockPayload, getBlockItemIds, readBlockPayload } from "../block-payload";
import {
  type BlockOutcome,
  capExtraPractice,
  getAnswersEnergyDelta,
  getOutcomeBonus,
  scoreAnswers,
} from "../brain-power";
import { getBlockMinutes } from "../daily-goal";
import { countAskableQuestions } from "./askable-questions";
import { getBlockEvents } from "./block-events";
import { getBlockElapsedMs, pausedBlockTiming } from "./block-timing";
import { loadBlockSkillStates } from "./load-block-skill-states";
import { completePlanItem, moveLostCheckpoint } from "./plan-items";
import { type SessionAnswer, getBlockAnswers, loadSessionAnswers } from "./session-answers";
import { trackBlockCompleted } from "./session-events";
import { type ProgressChange, applySessionProgress } from "./session-progress";
import { getMasteryRewards, readSessionSnapshot, withPaidRewards } from "./session-snapshot";
import { type StudySessionRow } from "./study-session-access";

const SECONDS_PER_MINUTE = 60;

/** The loser must roll back its early learner mark along with the no-transition settlement. */
class QuestionBlockUnchangedError extends Error {
  override name = "QuestionBlockUnchangedError";
}

export type QuestionBlockSettlement = {
  answers: SessionAnswer[];
  brainPower: number;
  brainPowerBefore: number;
  capsulesOpened: number;
  checkpoint: CheckpointOutcome | null;
  correct: number;
  energy: ProgressChange;
  seconds: number;
  topHyperdrive: number;
  total: number;
};

export type SettleQuestionBlockResult =
  | { settlement: QuestionBlockSettlement; status: "ready" }
  | { status: "blockFinished" }
  | { status: "emptyCheckpoint" }
  | { status: "noAnswers" }
  | { status: "unanswered" };

async function loadExtraEarnedToday(
  tx: TransactionClient,
  { localDate, userId }: { localDate: Date; userId: string },
) {
  const blocks = await tx.studySessionBlock.findMany({
    select: { brainPower: true, id: true, payload: true },
    where: { session: { localDate, userId }, status: "completed" },
  });

  return blocks
    .filter((block) => readBlockPayload(block).extra)
    .reduce((sum, block) => sum + block.brainPower, 0);
}

type PreparedBlock = {
  checkpoint: CheckpointOutcome | null;
  correct: number;
  current: Awaited<ReturnType<typeof loadBlockSkillStates>>;
  own: SessionAnswer[];
  payload: BlockPayload;
  scored: ReturnType<typeof scoreAnswers>;
};

type SettleInput = {
  block: StudySessionBlock;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
};

export async function prepareQuestionBlock({
  block,
  session,
  userId,
}: SettleInput): Promise<PreparedBlock | "emptyCheckpoint" | "noAnswers" | "unanswered"> {
  const payload = readBlockPayload(block);

  const answers = await loadSessionAnswers({
    blocks: session.blocks,
    sessionId: session.id,
    userId,
  });

  const own = getBlockAnswers({ answers, block });
  const firstAnsweredAt = own[0]?.answeredAt;

  if (!firstAnsweredAt) {
    const itemIds = getBlockItemIds(payload);

    if (
      block.status === "active" &&
      payload.checkpoint &&
      itemIds.length > 0 &&
      (await countAskableQuestions({ itemIds })) === 0
    ) {
      return "emptyCheckpoint";
    }

    return "noAnswers";
  }

  const answeredIds = new Set(own.flatMap((answer) => (answer.itemId ? [answer.itemId] : [])));
  const answered = answeredIds.size;
  const itemIds = getBlockItemIds(payload);

  // Judge checkpoints against questions still askable, rather than deleted or unavailable questions.
  const questions =
    payload.checkpoint && answered < itemIds.length
      ? await countAskableQuestions({ answeredItemIds: answeredIds, itemIds })
      : itemIds.length;

  if (
    payload.checkpoint &&
    answered < questions &&
    !isBlockDuelDecided({ answers: own, payload, questions })
  ) {
    return "unanswered";
  }

  const earlier = answers.filter(
    (answer) => !own.includes(answer) && answer.answeredAt < firstAnsweredAt,
  );

  const current = await loadBlockSkillStates({ answers: own, userId });

  return {
    checkpoint: getCheckpointOutcome({ answers: own, payload, questions }),
    correct: own.filter((answer) => answer.isCorrect).length,
    current,
    own,
    payload,
    scored: scoreAnswers({ answers: own, streak: scoreAnswers({ answers: earlier }).streak }),
  };
}

export function countOpenedCapsules({
  own,
  payload,
}: Pick<PreparedBlock, "own" | "payload">): number {
  return payload.capsules.filter((capsule) =>
    own.some((answer) => answer.itemId && capsule.itemIds.includes(answer.itemId)),
  ).length;
}

/** Read mastery rewards under the session lock so concurrent block completions cannot pay a skill twice. */
async function getBlockBrainPower(
  tx: TransactionClient,
  {
    prepared,
    session,
    userId,
  }: { prepared: PreparedBlock; session: StudySessionRow; userId: string },
) {
  const { payload, checkpoint } = prepared;

  const row = await tx.studySession.findUniqueOrThrow({
    select: { startSnapshot: true },
    where: { id: session.id },
  });

  const snapshot = readSessionSnapshot(row.startSnapshot);

  const masteryRewards = snapshot
    ? getMasteryRewards({ current: prepared.current, snapshot })
    : { mastered: [], solid: [] };

  const outcome: BlockOutcome = {
    capsulesOpened: countOpenedCapsules(prepared),
    checkpoint: checkpoint ? { kind: checkpoint.kind, passed: checkpoint.passed } : null,
    firstLessonCompletion: false,
    skillsMastered: masteryRewards.mastered.length,
    skillsSolid: masteryRewards.solid.length,
  };

  const earned = prepared.scored.brainPower + getOutcomeBonus(outcome);

  const brainPower = payload.extra
    ? capExtraPractice({
        earned,
        earnedToday: await loadExtraEarnedToday(tx, { localDate: session.localDate, userId }),
      })
    : earned;

  if (snapshot) {
    await tx.studySession.update({
      data: { startSnapshot: withPaidRewards({ rewards: masteryRewards, snapshot }) },
      where: { id: session.id },
    });
  }

  return { brainPower, capsulesOpened: outcome.capsulesOpened };
}

/** Settles a block once under the progress lock, caps extra practice rewards, and emits completion only after settlement. */
export async function settleQuestionBlock(input: SettleInput): Promise<SettleQuestionBlockResult> {
  const prepared = await prepareQuestionBlock(input);

  if (prepared === "emptyCheckpoint" || prepared === "noAnswers" || prepared === "unanswered") {
    return { status: prepared };
  }

  const { block, session, timeZone, userId } = input;
  const { checkpoint, correct, own, payload, scored } = prepared;

  const { data: result, error } = await safeAsync(() =>
    prisma.$transaction(async (tx): Promise<SettleQuestionBlockResult> => {
      await markLearnerChanged(tx, { planInputs: true, userId });

      const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });

      const { count } = await tx.studySessionBlock.updateMany({
        data: { completedAt: lock.completedAt, status: "completed" },
        where: { id: block.id, status: { in: ["active", "pending"] } },
      });

      if (count === 0) {
        throw new QuestionBlockUnchangedError("The question block was already settled");
      }

      const reward = await getBlockBrainPower(tx, { prepared, session, userId });

      const currentBlock = await tx.studySessionBlock.findUniqueOrThrow({
        where: { id: block.id },
      });

      const currentPayload = readBlockPayload(currentBlock);

      const seconds = Math.round(
        getBlockMinutes({
          completedAt: lock.completedAt,
          estimatedMinutes: currentBlock.estimatedMinutes ?? 0,
          startedAt: currentPayload.timing
            ? new Date(
                lock.completedAt.getTime() -
                  getBlockElapsedMs({ block: currentBlock, now: lock.completedAt }),
              )
            : currentBlock.startedAt,
        }) * SECONDS_PER_MINUTE,
      );

      const progress = await applySessionProgress(tx, {
        completion: true,
        delta: {
          brainPower: reward.brainPower,
          correctAnswers: correct,
          energyDelta: getAnswersEnergyDelta({ correct, incorrect: own.length - correct }),
          incorrectAnswers: own.length - correct,
          seconds,
        },
        lock,
        userId,
      });

      await tx.studySessionBlock.update({
        data: {
          brainPower: reward.brainPower,
          payload: {
            ...currentPayload,
            milestoneReward: {
              bossWon: checkpoint !== null && checkpoint.kind !== "weekly" && checkpoint.passed,
              brainPower: progress.brainPower,
            },
            timing: pausedBlockTiming({ block: currentBlock, now: lock.completedAt }),
          },
        },
        where: { id: block.id },
      });

      const events = getBlockEvents({
        answers: own,
        block,
        brainPower: reward.brainPower,
        payload,
        points: scored.points,
        seconds,
      });

      await Promise.all(
        events.map((event) =>
          recordLearningEvent(tx, {
            ...event,
            endedAt: lock.completedAt,
            goalId: session.goalId,
            startedAt: block.startedAt ?? lock.completedAt,
            timeZone,
            userId,
          }),
        ),
      );

      // A lost phase checkpoint retries tomorrow; a finished weekly challenge does not.
      const done = checkpoint ? checkpoint.passed || checkpoint.kind === "weekly" : true;

      if (payload.planItemId) {
        const item = { planItemId: payload.planItemId, userId };

        await (done
          ? completePlanItem(tx, { ...item, now: lock.completedAt })
          : moveLostCheckpoint(tx, { ...item, localDate: session.localDate }));
      }

      return {
        settlement: {
          answers: own,
          brainPower: reward.brainPower,
          brainPowerBefore: progress.brainPower.before,
          capsulesOpened: reward.capsulesOpened,
          checkpoint,
          correct,
          energy: progress.energy,
          seconds,
          topHyperdrive: scored.topLevel,
          total: own.length,
        },
        status: "ready",
      };
    }),
  );

  if (error instanceof QuestionBlockUnchangedError) {
    return { status: "blockFinished" };
  }

  if (error) {
    throw error;
  }

  if (result.status === "ready") {
    trackBlockCompleted({ block, seconds: result.settlement.seconds, session });
  }

  return result;
}
