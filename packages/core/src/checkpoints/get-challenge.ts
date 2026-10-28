import "server-only";
import { prisma } from "@zoonk/db";
import { hasStoredTimeRunOutAway } from "../exams/mocks/_utils/owned-mock";
import { getWrongPenalty } from "../exams/scoring/mock-scoring";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { loadMilestoneCounts } from "../milestones/award-milestones";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { type PlanEffect } from "../plans/planner/plan-effect";
import { parsePlanPhases } from "../plans/planner/plan-state";
import { readBlockPayload } from "../sessions/block-payload";
import { getStoredBlockWait } from "../sessions/block-wait";
import { type CheckpointKind } from "../sessions/brain-power";
import { type StudySessionTimeZoneInput } from "../sessions/contract";
import { type BossTiming, getBossTimings } from "./_utils/boss-reached";
import { countBlockRecordings } from "./_utils/boss-recordings";
import { getAvailableChallengeStatus } from "./_utils/challenge-availability";
import { loadChallengeCall } from "./_utils/challenge-call";
import { getNextStudyDay, readDailyLimitReachedToday } from "./_utils/challenge-daily-limit";
import { canMoveToMonday, loadChallengeMoveRules, loadMoveEffect } from "./_utils/challenge-move";
import { readBossOffer } from "./_utils/challenge-offer";
import { needsPlus } from "./_utils/challenge-plus";
import { loadChallengeSize } from "./_utils/challenge-size";
import { getChallengeStatus } from "./_utils/challenge-status";
import { loadChallengeTopics } from "./_utils/challenge-topics";
import { getAskablePassMark } from "./_utils/checkpoint-outcome";
import { loadResultReinforcement } from "./_utils/checkpoint-reinforcement";
import { findLastCheckpointResult } from "./_utils/checkpoint-results";
import { isFinalBoss } from "./_utils/load-boss";
import { isWeeklyChallengeItem } from "./_utils/load-weekly-challenge";
import {
  type ChallengeBlock,
  type OwnedChallenge,
  findChallengeBlock,
  findOwnedChallenge,
  getTodayBlock,
} from "./_utils/owned-challenge";
import { type ChallengeCall, type ChallengeView } from "./challenge-contract";
import { getCheckpointReward } from "./checkpoint-reward";
import { getPassMark } from "./checkpoint-rules";

export type ChallengeResult =
  | { challenge: ChallengeView; moved?: PlanEffect | null; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

function getKind(challenge: OwnedChallenge): CheckpointKind {
  if (isWeeklyChallengeItem(challenge.item)) {
    return "weekly";
  }

  return isFinalBoss({ boss: challenge.item, items: challenge.items }) ? "finalBoss" : "boss";
}

function getTiming(challenge: OwnedChallenge): BossTiming {
  const { item, items, today } = challenge;

  if (item.kind === "boss") {
    return getBossTimings({ items, today }).get(item.id) ?? "date";
  }

  return item.scheduledFor !== null && item.scheduledFor <= today ? "nextSession" : "date";
}

async function canMove({
  challenge,
  todayBlock,
}: {
  challenge: OwnedChallenge;
  todayBlock: ChallengeBlock | null;
}): Promise<boolean> {
  if (!isWeeklyChallengeItem(challenge.item) || (todayBlock && todayBlock.status !== "pending")) {
    return false;
  }

  const rules = await loadChallengeMoveRules(challenge.goal.id);

  return canMoveToMonday({ item: challenge.item, rules, today: challenge.today });
}

function findPhase(challenge: OwnedChallenge) {
  const phases = parsePlanPhases(challenge.plan.phases);
  const phase = phases[challenge.item.phase];

  return phase ? { index: challenge.item.phase, name: phase.name } : null;
}

function getOpenBlockId({
  block,
  todayBlock,
}: {
  block: ChallengeBlock | null;
  todayBlock: ChallengeBlock | null;
}): string | null {
  if (todayBlock) {
    return todayBlock.id;
  }

  return block?.status === "completed" ? block.id : null;
}

function getChallengePassMark({
  block,
  call,
  kind,
  size,
}: {
  block: ChallengeBlock | null;
  call: ChallengeCall | null;
  kind: CheckpointKind;
  size: { questions: number | null };
}): number | null {
  if (kind === "weekly") {
    return null;
  }

  if (call) {
    return call.goals === null ? null : getPassMark(call.goals.length);
  }

  const { questions } = size;

  if (questions === null) {
    return null;
  }

  const payload = block ? readBlockPayload(block) : null;
  return payload?.checkpoint ? getAskablePassMark({ payload, questions }) : getPassMark(questions);
}

/** A mock that expired while away starts again as an unstarted block. */
async function readTodayBlockStatus({
  isMock,
  todayBlock,
}: {
  isMock: boolean;
  todayBlock: ChallengeBlock | null;
}) {
  if (!isMock || todayBlock?.status !== "active") {
    return todayBlock?.status ?? null;
  }

  const sitting = await prisma.mockExam.findUnique({
    select: {
      answers: { select: { answer: true } },
      conditions: true,
      sectionIndex: true,
      sectionStartedAt: true,
      status: true,
    },
    where: { blockId: todayBlock.id },
  });

  const isOver = !sitting || hasStoredTimeRunOutAway({ mock: sitting, now: Date.now() });
  return isOver ? "pending" : "active";
}

function isOfferedBeforeOpen({
  challenge,
  due,
  plusRequired,
  savedDay,
}: {
  challenge: OwnedChallenge;
  due: boolean;
  plusRequired: boolean;
  savedDay: boolean;
}): boolean {
  const offerable = !savedDay && due && !plusRequired && challenge.goal.status === "active";
  return offerable && !readBossOffer(challenge)?.waiting;
}

type SavedDayBlock = Pick<ChallengeBlock, "id" | "kind" | "payload" | "position" | "status">;

function getSavedWaitReason({
  savedBlocks,
  todayBlock,
}: {
  savedBlocks: readonly SavedDayBlock[];
  todayBlock: ChallengeBlock | null;
}): ChallengeView["waitReason"] {
  const saved = todayBlock ? savedBlocks.find((row) => row.id === todayBlock.id) : undefined;
  return saved ? getStoredBlockWait({ block: saved, blocks: savedBlocks }) : null;
}

async function loadChallengeDay(challenge: OwnedChallenge) {
  const { goal, item, today, userId } = challenge;
  const timing = getTiming(challenge);
  const due = timing === "nextSession" && item.status === "todo";

  const [plusRequired, block, savedDay] = await Promise.all([
    needsPlus(challenge),
    findChallengeBlock({ challenge }),
    prisma.studySession.findUnique({
      select: {
        blocks: { select: { id: true, kind: true, payload: true, position: true, status: true } },
        id: true,
      },
      where: { userGoalDate: { goalId: goal.id, localDate: today, userId } },
    }),
  ]);

  const todayBlock = getTodayBlock({ block, today });

  const offered = isOfferedBeforeOpen({
    challenge,
    due,
    plusRequired,
    savedDay: Boolean(savedDay),
  });

  const status = getChallengeStatus({
    due,
    itemStatus: item.status,
    plusRequired,
    queued: timing === "queued",
    todayBlockStatus: offered
      ? "pending"
      : await readTodayBlockStatus({ isMock: item.kind === "mock", todayBlock }),
  });

  // An earlier day's block isn't the one Start opens today: the offer is sized as its item keeps it.
  return {
    plusRequired,
    previewBlock: offered ? null : block,
    status,
    todayBlock,
    waitReason: getSavedWaitReason({ savedBlocks: savedDay?.blocks ?? [], todayBlock }),
  };
}

function loadRecordings({
  block,
  challenge,
}: {
  block: ChallengeBlock | null;
  challenge: OwnedChallenge;
}) {
  if (challenge.item.kind === "mock") {
    return 0;
  }

  if (block) {
    return countBlockRecordings(readBlockPayload(block).itemIds);
  }

  return readBossOffer(challenge)?.kind === "recording" ? null : 0;
}

export async function getChallenge({
  input,
  movedBy,
  planItemId,
}: {
  input: Partial<StudySessionTimeZoneInput>;
  movedBy?: string | null;
  planItemId: string;
}): Promise<ChallengeResult> {
  const owned = await findOwnedChallenge({ planItemId, timeZone: input.timeZone });

  if (owned.status !== "ready") {
    return owned;
  }

  const { challenge } = owned;
  const { goal, item, today, userId } = challenge;
  const kind = getKind(challenge);
  const isMock = item.kind === "mock";

  const { plusRequired, previewBlock, status, todayBlock, waitReason } =
    await loadChallengeDay(challenge);

  const blockId = getOpenBlockId({ block: previewBlock, todayBlock });

  const [size, canMoveIt, lastResult, counts, recordings, topics, call, limitReached, moved] =
    await Promise.all([
      loadChallengeSize({ block: previewBlock, challenge }),
      status !== "plusRequired" && canMove({ challenge, todayBlock }),
      kind === "weekly" ? null : findLastCheckpointResult({ planItemId: item.id, userId }),
      loadMilestoneCounts(userId),
      loadRecordings({ block: previewBlock, challenge }),
      loadChallengeTopics({ block: previewBlock, challenge }),
      loadChallengeCall({ blockId, challenge }),
      status === "ready" && !waitReason && readDailyLimitReachedToday(userId),
      movedBy ? loadMoveEffect({ changeId: movedBy, planId: item.planId }) : null,
    ]);

  const reinforcement = await loadResultReinforcement({ result: lastResult, userId });
  const shown = getAvailableChallengeStatus({ block: previewBlock, call, isMock, size, status });
  const dailyLimitReached = shown === "ready" && limitReached;

  return {
    challenge: {
      blockId,
      call,
      canMove: canMoveIt,
      dailyLimitReached,
      date: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
      estimatedMinutes: size.estimatedMinutes,
      examName: isMock ? (goal.examBlueprint?.name ?? goal.title) : null,
      fullLength: size.fullLength,
      goalId: goal.id,
      kind,
      leftOut: size.leftOut,
      locked: plusRequired,
      minutes: size.minutes,
      mock: isMock,
      netScored: size.netScored,
      nextStudyDate: getNextStudyDay({ challenge, dailyLimitReached, kind }),
      number: size.number,
      passMark: getChallengePassMark({ block: previewBlock, call, kind, size }),
      phase: findPhase(challenge),
      planItemId: item.id,
      questions: size.questions,
      recordings,
      reinforcementLessons: reinforcement.length,
      rematch: Boolean(lastResult && !lastResult.passed && lastResult.localDate < today),
      result: lastResult
        ? { correct: lastResult.correct, passed: lastResult.passed, total: lastResult.total }
        : null,
      reward: getCheckpointReward({ counts, kind }),
      sections: size.sections,
      startTime: size.startTime ?? goal.studyTime,
      status: shown,
      timeZone: size.startTime ? size.timeZone : null,
      title: item.titleSnapshot,
      today: toIsoDate(today),
      topics,
      waitReason,
      written: size.written,
      wrongPenalty: isMock
        ? getWrongPenalty(
            goal.examBlueprint ? readBlueprintContent(goal.examBlueprint).structure : null,
          )
        : 0,
    },
    moved,
    status: "ready",
  };
}
