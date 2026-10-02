import "server-only";
import {
  type MasteryState,
  type StudySessionBlock,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import {
  type CheckpointOutcome,
  getCheckpointOutcome,
} from "../../checkpoints/_utils/checkpoint-outcome";
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
import { getBlockEvents } from "./block-events";
import { completePlanItem } from "./plan-items";
import { type SessionAnswer, getBlockAnswers, loadSessionAnswers } from "./session-answers";
import { trackBlockCompleted } from "./session-events";
import { getLearnerMode } from "./session-ledger";
import { applySessionProgress } from "./session-progress";
import { getMasteryRewards, readSessionSnapshot, withPaidRewards } from "./session-snapshot";
import { type StudySessionRow } from "./study-session-access";

const SECONDS_PER_MINUTE = 60;

type QuestionBlockSettlement = {
  answers: SessionAnswer[];
  brainPower: number;
  brainPowerBefore: number;
  capsulesOpened: number;
  checkpoint: CheckpointOutcome | null;
  correct: number;
  /** How long the block took, as the ledger and today's totals count it. */
  seconds: number;
  topHyperdrive: number;
  total: number;
};

export type SettleQuestionBlockResult =
  | { settlement: QuestionBlockSettlement; status: "ready" }
  | { status: "blockFinished" }
  | { status: "noAnswers" }
  | { status: "unanswered" };

async function loadCurrentStates({
  answers,
  userId,
}: {
  answers: readonly SessionAnswer[];
  userId: string;
}) {
  const skillIds = [
    ...new Set(answers.flatMap((answer) => (answer.skillId ? [answer.skillId] : []))),
  ];

  const rows = await prisma.learnerSkill.findMany({
    select: { skillId: true, state: true },
    where: { skillId: { in: skillIds }, userId },
  });

  return Object.fromEntries(rows.map((row): [string, MasteryState] => [row.skillId, row.state]));
}

/** Brain Power extra blocks already earned today, across the learner's sessions. */
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
  current: Record<string, MasteryState>;
  mode: Awaited<ReturnType<typeof getLearnerMode>>;
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

/** Reads and scores the block's answers, continuing Hyperdrive from the session's earlier blocks. */
async function prepareBlock({
  block,
  session,
  userId,
}: SettleInput): Promise<PreparedBlock | "noAnswers" | "unanswered"> {
  const payload = readBlockPayload(block);

  const answers = await loadSessionAnswers({
    blocks: session.blocks,
    sessionId: session.id,
    userId,
  });

  const own = getBlockAnswers({ answers, block });
  const firstAnsweredAt = own[0]?.answeredAt;

  if (!firstAnsweredAt) {
    return "noAnswers";
  }

  if (payload.checkpoint && own.length < getBlockItemIds(payload).length) {
    return "unanswered";
  }

  const earlier = answers.filter(
    (answer) => !own.includes(answer) && answer.answeredAt < firstAnsweredAt,
  );

  const [current, mode] = await Promise.all([
    loadCurrentStates({ answers: own, userId }),
    getLearnerMode(userId),
  ]);

  return {
    checkpoint: getCheckpointOutcome({ answers: own, payload }),
    correct: own.filter((answer) => answer.isCorrect).length,
    current,
    mode,
    own,
    payload,
    scored: scoreAnswers({ answers: own, streak: scoreAnswers({ answers: earlier }).streak }),
  };
}

/**
 * Brain Power for the block with its bonuses. Mastery bonuses read the session's snapshot inside
 * the lock, so a skill's Solid or Mastered bonus is paid once even if two blocks finish together.
 */
async function getBlockBrainPower(
  tx: TransactionClient,
  {
    prepared,
    session,
    userId,
  }: { prepared: PreparedBlock; session: StudySessionRow; userId: string },
) {
  const { payload, own, checkpoint } = prepared;

  const row = await tx.studySession.findUniqueOrThrow({
    select: { startSnapshot: true },
    where: { id: session.id },
  });

  const snapshot = readSessionSnapshot(row.startSnapshot);

  const masteryRewards = snapshot
    ? getMasteryRewards({ current: prepared.current, snapshot })
    : { mastered: [], solid: [] };

  const outcome: BlockOutcome = {
    capsulesOpened: payload.capsules.filter((capsule) =>
      own.some((answer) => answer.itemId && capsule.itemIds.includes(answer.itemId)),
    ).length,
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

/**
 * Scores a finished question block (capsules, practice or a checkpoint) and writes it: Brain Power
 * with Hyperdrive continuing from earlier blocks, bonuses for capsules, mastery and checkpoints,
 * Energy by today's rules, the ledger rows and today's totals, all under the learner's progress
 * lock. Extra practice after the day's session is capped. A block is only settled once, and only
 * then sends "Block Completed".
 */
export async function settleQuestionBlock(input: SettleInput): Promise<SettleQuestionBlockResult> {
  const prepared = await prepareBlock(input);

  if (prepared === "noAnswers" || prepared === "unanswered") {
    return { status: prepared };
  }

  const { block, session, timeZone, userId } = input;
  const { checkpoint, correct, own, payload, scored } = prepared;

  const result = await prisma.$transaction(async (tx): Promise<SettleQuestionBlockResult> => {
    const lock = await getCompletionEnergyContext({ timeZone, transaction: tx, userId });

    const { count } = await tx.studySessionBlock.updateMany({
      data: { completedAt: lock.completedAt, status: "completed" },
      where: { id: block.id, status: { in: ["active", "pending"] } },
    });

    if (count === 0) {
      return { status: "blockFinished" };
    }

    const reward = await getBlockBrainPower(tx, { prepared, session, userId });

    await tx.studySessionBlock.update({
      data: { brainPower: reward.brainPower },
      where: { id: block.id },
    });

    const seconds = Math.round(
      getBlockMinutes({
        completedAt: lock.completedAt,
        estimatedMinutes: block.estimatedMinutes ?? 0,
        startedAt: block.startedAt,
      }) * SECONDS_PER_MINUTE,
    );

    const { before } = await applySessionProgress(tx, {
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
          mode: prepared.mode,
          startedAt: block.startedAt ?? lock.completedAt,
          timeZone,
          userId,
        }),
      ),
    );

    // A checkpoint won, a weekly challenge finished or a review day practiced checks its item off.
    const done = checkpoint ? checkpoint.passed || checkpoint.kind === "weekly" : true;

    if (payload.planItemId && done) {
      await completePlanItem(tx, { now: lock.completedAt, planItemId: payload.planItemId, userId });
    }

    return {
      settlement: {
        answers: own,
        brainPower: reward.brainPower,
        brainPowerBefore: before,
        capsulesOpened: reward.capsulesOpened,
        checkpoint,
        correct,
        seconds,
        topHyperdrive: scored.topLevel,
        total: own.length,
      },
      status: "ready",
    };
  });

  if (result.status === "ready") {
    trackBlockCompleted({ block, seconds: result.settlement.seconds, session });
  }

  return result;
}
