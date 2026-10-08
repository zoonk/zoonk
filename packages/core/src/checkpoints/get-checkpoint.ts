import "server-only";
import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { loadMilestoneCounts } from "../milestones/award-milestones";
import { parsePlanPhases } from "../plans/planner/plan-state";
import { readBlockPayload } from "../sessions/block-payload";
import { type StudyBlockResult, getStudyBlock } from "../sessions/get-study-block";
import { getSession } from "../users/get-session";
import { type CheckpointPhase, type CheckpointView } from "./checkpoint-contract";
import { getCheckpointReward } from "./checkpoint-reward";
import { REINFORCEMENT_LESSONS, getPassMark, hasPassedCheckpoint } from "./checkpoint-rules";
import { EXAM_DAY_CHECKLIST } from "./weekly-challenge-rules";

type BlockDetail = Extract<StudyBlockResult, { status: "ready" }>["detail"];

export type CheckpointResult =
  | { checkpoint: CheckpointView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function findCheckpointBlock({ blockId, userId }: { blockId: string; userId: string }) {
  return prisma.studySessionBlock.findFirst({
    include: { session: { include: { goal: true } } },
    where: { id: blockId, kind: "checkpoint", session: { userId } },
  });
}

/**
 * A phase checkpoint that didn't pass, as things stand now rather than when it finished: its new
 * try is tomorrow on the day it was played, back in the plan after that, and behind the learner
 * once a later try passed.
 */
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

/** How a finished checkpoint went, from the answers given in its block. */
function getResult(detail: BlockDetail): CheckpointView["result"] {
  if (detail.block.status !== "completed") {
    return null;
  }

  const answered = detail.questions.filter((question) => question.answered !== null);
  const correct = answered.filter((question) => question.answered?.isCorrect).length;

  return {
    correct,
    passed: hasPassedCheckpoint({ correct, passMark: getPassMark(answered.length) }),
    total: answered.length,
  };
}

/** One of the signed-in learner's checkpoint blocks, by its id, with its questions but no answers. */
export async function getCheckpoint(blockId: string): Promise<CheckpointResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const block = isUuid(blockId) ? await findCheckpointBlock({ blockId, userId }) : null;

  if (!block) {
    return { status: "notFound" };
  }

  const { planItemId } = readBlockPayload(block);

  const [found, phases, counts, item] = await Promise.all([
    getStudyBlock({ blockId, sessionId: block.sessionId }),
    loadPhases(block.session.goalId),
    loadMilestoneCounts(userId),
    planItemId && isUuid(planItemId)
      ? prisma.planItem.findUnique({ where: { id: planItemId } })
      : null,
  ]);

  const checkpoint = found.status === "ready" ? found.detail.block.checkpoint : null;

  if (found.status !== "ready" || !checkpoint) {
    return { status: "notFound" };
  }

  const { detail } = found;
  const phase = phases.find((candidate) => candidate.index === checkpoint.phase) ?? null;
  const result = getResult(detail);

  return {
    checkpoint: {
      blockId,
      checklist: checkpoint.mock ? [...EXAM_DAY_CHECKLIST] : [],
      kind: checkpoint.kind,
      mock: checkpoint.mock,
      nextPhase: phase ? (phases.find((next) => next.index === phase.index + 1) ?? null) : null,
      passMark: checkpoint.passMark,
      phase,
      planItemId,
      questions: detail.questions,
      reinforcementLessons: REINFORCEMENT_LESSONS,
      rematch: checkpoint.rematch,
      result,
      retry:
        checkpoint.kind === "weekly"
          ? null
          : getRetry({ goal: block.session.goal, item, playedOn: block.session.localDate, result }),
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
