import "server-only";
import { type Goal, type LearningEvent, type PlanItem, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { loadMilestoneCounts } from "../milestones/award-milestones";
import { parsePlanPhases } from "../plans/planner/plan-state";
import { findOwnedStudyBlock } from "../sessions/_utils/study-session-access";
import { type BlockPayload, readBlockPayload } from "../sessions/block-payload";
import { type StudyBlockResult, loadStudyBlock } from "../sessions/get-study-block";
import { getSession } from "../users/get-session";
import { getAskablePassMark } from "./_utils/checkpoint-outcome";
import { loadCheckpointReinforcement } from "./_utils/checkpoint-reinforcement";
import { type CheckpointPhase, type CheckpointView } from "./checkpoint-contract";
import { getCheckpointReward } from "./checkpoint-reward";
import { getPassMark, hasPassedCheckpoint } from "./checkpoint-rules";
import { EXAM_DAY_CHECKLIST } from "./weekly-challenge-rules";

type BlockDetail = Extract<StudyBlockResult, { status: "ready" }>["detail"];

export type CheckpointResult =
  | { checkpoint: CheckpointView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function findCheckpointBlock({ blockId, userId }: { blockId: string; userId: string }) {
  return prisma.studySessionBlock.findFirst({
    where: { id: blockId, kind: "checkpoint", session: { userId } },
  });
}

function getRetry({
  goal,
  item,
  playedOn,
  result,
}: {
  goal: Goal | null;
  item: Pick<PlanItem, "status"> | null;
  playedOn: Date;
  result: CheckpointView["result"];
}): CheckpointView["retry"] {
  if (!result || result.passed || !item) {
    return null;
  }

  if (item.status !== "todo") {
    return item.status === "done" ? "passed" : null;
  }

  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });
  return playedOn.getTime() === today.getTime() ? "tomorrow" : "open";
}

async function loadPhases(goalId: string | null): Promise<CheckpointPhase[]> {
  if (!goalId) {
    return [];
  }

  const plan = await prisma.plan.findUnique({ select: { phases: true }, where: { goalId } });

  return parsePlanPhases(plan?.phases).map((phase, index) => ({ index, name: phase.name }));
}

function getResult({
  detail,
  payload,
  savedScore,
}: {
  detail: BlockDetail;
  payload: BlockPayload;
  savedScore: Pick<LearningEvent, "correctAnswers" | "incorrectAnswers"> | null;
}): CheckpointView["result"] {
  if (detail.block.status !== "completed") {
    return null;
  }

  const answered = detail.questions.filter((question) => question.answered !== null);

  const correct =
    savedScore?.correctAnswers ??
    answered.filter((question) => question.answered?.isCorrect).length;

  const total = savedScore
    ? savedScore.correctAnswers + savedScore.incorrectAnswers
    : answered.length;

  const settled = payload.checkpoint?.kind === "weekly" ? null : payload.milestoneReward;

  return {
    correct,
    passed: settled?.bossWon ?? hasPassedCheckpoint({ correct, passMark: getPassMark(total) }),
    total,
  };
}

/** Requires ownership of the block; returns questions without their answers. */
export async function getCheckpoint(blockId: string): Promise<CheckpointResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const checkpointBlock = isUuid(blockId) ? await findCheckpointBlock({ blockId, userId }) : null;

  if (!checkpointBlock) {
    return { status: "notFound" };
  }

  const owned = await findOwnedStudyBlock({ blockId, sessionId: checkpointBlock.sessionId });

  if (owned.status !== "ready") {
    return { status: "notFound" };
  }

  const { block, session: studySession } = owned;
  const payload = readBlockPayload(block);
  const { planItemId } = payload;
  const checkpoint = payload.checkpoint;

  if (!checkpoint) {
    return { status: "notFound" };
  }

  const [detail, phases, counts, item, reinforcement, savedScore] = await Promise.all([
    loadStudyBlock(owned),
    loadPhases(studySession.goalId),
    loadMilestoneCounts(userId),
    planItemId && isUuid(planItemId)
      ? prisma.planItem.findUnique({ where: { id: planItemId } })
      : null,
    loadCheckpointReinforcement({ block, userId }),
    block.status === "completed"
      ? prisma.learningEvent.findFirst({
          where: {
            contentIds: { equals: blockId, path: ["studySessionBlockId"] },
            endedAt: { not: null },
            kind: { in: ["checkpoint", "mock"] },
            userId,
          },
        })
      : null,
  ]);

  const phase = phases.find((candidate) => candidate.index === checkpoint.phase) ?? null;
  const result = getResult({ detail, payload, savedScore });

  return {
    checkpoint: {
      answeredQuestions: detail.answeredQuestions,
      blockId,
      checklist: checkpoint.mock ? [...EXAM_DAY_CHECKLIST] : [],
      endedWithoutQuestions: payload.checkpointAbandoned,
      kind: checkpoint.kind,
      mock: checkpoint.mock,
      nextPhase: phase ? (phases.find((next) => next.index === phase.index + 1) ?? null) : null,
      passMark: getAskablePassMark({ payload, questions: detail.block.questions }),
      phase,
      planItemId,
      questions: detail.questions,
      reinforcementLessons: reinforcement.length,
      rematch: checkpoint.rematch,
      result,
      retry:
        checkpoint.kind === "weekly"
          ? null
          : getRetry({ goal: studySession.goal, item, playedOn: studySession.localDate, result }),
      reward: getCheckpointReward({ counts, kind: checkpoint.kind }),
      sessionId: block.sessionId,
      status: detail.block.status,
      timeLimitMinutes: checkpoint.timeLimitMinutes,
      title: detail.block.title,
      trueFalseLabels: detail.trueFalseLabels,
    },
    status: "ready",
  };
}
