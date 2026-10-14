import "server-only";
import { prisma } from "@zoonk/db";
import { hasStoredTimeRunOutAway } from "../exams/mocks/_utils/owned-mock";
import { getWrongPenalty } from "../exams/scoring/mock-scoring";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { loadMilestoneCounts } from "../milestones/award-milestones";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { parsePlanPhases } from "../plans/planner/plan-state";
import { readBlockPayload } from "../sessions/block-payload";
import { type CheckpointKind } from "../sessions/brain-power";
import { type StudySessionTimeZoneInput } from "../sessions/contract";
import { ensureStudySession } from "../sessions/ensure-study-session";
import { type BossTiming, getBossTimings } from "./_utils/boss-reached";
import { countBlockRecordings } from "./_utils/boss-recordings";
import { loadChallengeCall } from "./_utils/challenge-call";
import { getMovableDay, loadChallengeMoveRules } from "./_utils/challenge-move";
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
import { type ChallengeCall, type ChallengeStatus, type ChallengeView } from "./challenge-contract";
import { getCheckpointReward } from "./checkpoint-reward";
import { getPassMark } from "./checkpoint-rules";

export type ChallengeResult =
  | { challenge: ChallengeView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

function getKind(challenge: OwnedChallenge): CheckpointKind {
  if (isWeeklyChallengeItem(challenge.item)) {
    return "weekly";
  }

  return isFinalBoss({ boss: challenge.item, items: challenge.items }) ? "finalBoss" : "boss";
}

/**
 * When the challenge comes: a phase's as sessions offer them, as the Plan says it (see
 * `getBossTimings`); the week's and a mock in the next session once their day came.
 */
function getTiming(challenge: OwnedChallenge): BossTiming {
  const { item, items, today } = challenge;

  if (item.kind === "boss") {
    return getBossTimings({ items, today }).get(item.id) ?? "date";
  }

  return item.scheduledFor !== null && item.scheduledFor <= today ? "nextSession" : "date";
}

/** The week's challenge moves before it starts, from today or a later day. */
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
  return getMovableDay({ item: challenge.item, rules, today: challenge.today }) !== null;
}

function findPhase(challenge: OwnedChallenge) {
  const phases = parsePlanPhases(challenge.plan.phases);
  const phase = phases[challenge.item.phase];

  return phase ? { index: challenge.item.phase, name: phase.name } : null;
}

/** The block it's played in that the intro opens: today's, or the last one, once finished. */
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

/** An unavailable milestone is pending content, not an empty future or queued offer. */
function getAvailableChallengeStatus({
  block,
  call,
  isMock,
  questions,
  status,
}: {
  block: ChallengeBlock | null;
  call: ChallengeCall | null;
  isMock: boolean;
  questions: number;
  status: ChallengeStatus;
}): ChallengeStatus {
  const pending = status === "upcoming" || status === "queued";
  return pending && !isMock && !call && !block && questions === 0 ? "waiting" : status;
}

/**
 * What wins a phase checkpoint: right answers (its block's pass mark on the questions it can still
 * ask, `getAskablePassMark`, or seven of ten before it's planned), or for a unit's call most of its
 * goals, once its call is written.
 */
function getChallengePassMark({
  block,
  call,
  kind,
  questions,
}: {
  block: ChallengeBlock | null;
  call: ChallengeCall | null;
  kind: CheckpointKind;
  questions: number;
}): number | null {
  if (kind === "weekly") {
    return null;
  }

  if (call) {
    return call.goals === null ? null : getPassMark(call.goals.length);
  }

  const payload = block ? readBlockPayload(block) : null;
  return payload?.checkpoint ? getAskablePassMark({ payload, questions }) : getPassMark(questions);
}

/**
 * Today's block as the intro reads it. A mock's block holds no running sitting once its time ran out
 * while the learner was away (see `hasTimeRunOutAway`), so it starts again, like one never started.
 */
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

/**
 * Where the challenge stands today. On its day, today's session is planned first (as Today plans
 * it), so the intro says exactly what it asks, or that the day was planned without it.
 */
async function loadChallengeDay(challenge: OwnedChallenge) {
  const { goal, item, timeZone, today, userId } = challenge;
  const timing = getTiming(challenge);
  const due = timing === "nextSession" && item.status === "todo";
  const plusRequired = await needsPlus(challenge);

  if (due && !plusRequired && goal.status === "active") {
    await ensureStudySession({ goal, localDate: today, timeZone, userId });
  }

  const block = await findChallengeBlock({ challenge });
  const todayBlock = getTodayBlock({ block, today });

  const status = getChallengeStatus({
    due,
    itemStatus: item.status,
    plusRequired,
    queued: timing === "queued",
    todayBlockStatus: await readTodayBlockStatus({ isMock: item.kind === "mock", todayBlock }),
  });

  return { block, plusRequired, status, todayBlock };
}

/**
 * One of the learner's challenges by its plan item, before its day and on it: a phase checkpoint
 * (the Trickster) or the week's challenge (an exam's mock). It says when it is, what it asks, what
 * it's worth and where it stands, so the learner can see it coming and, on its day, start it.
 */
export async function getChallenge({
  input,
  planItemId,
}: {
  input: Partial<StudySessionTimeZoneInput>;
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
  const { block, plusRequired, status, todayBlock } = await loadChallengeDay(challenge);
  const blockId = getOpenBlockId({ block, todayBlock });

  const [size, canMoveIt, lastResult, counts, recordings, topics, call] = await Promise.all([
    loadChallengeSize({ block, challenge }),
    // A mock the plan doesn't include has no day of its own to move.
    status !== "plusRequired" && canMove({ challenge, todayBlock }),
    kind === "weekly" ? null : findLastCheckpointResult({ planItemId: item.id, userId }),
    loadMilestoneCounts(userId),
    isMock || !block ? 0 : countBlockRecordings(readBlockPayload(block).itemIds),
    loadChallengeTopics({ block, challenge }),
    loadChallengeCall({ blockId, challenge }),
  ]);

  const reinforcement = await loadResultReinforcement({ result: lastResult, userId });

  return {
    challenge: {
      blockId,
      call,
      canMove: canMoveIt,
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
      number: size.number,
      passMark: getChallengePassMark({ block, call, kind, questions: size.questions }),
      phase: findPhase(challenge),
      planItemId: item.id,
      questions: size.questions,
      recordings,
      reinforcementLessons: reinforcement.length,
      // A new try is one after a day that didn't pass; today's is "tried" until tomorrow.
      rematch: Boolean(lastResult && !lastResult.passed && lastResult.localDate < today),
      result: lastResult
        ? { correct: lastResult.correct, passed: lastResult.passed, total: lastResult.total }
        : null,
      reward: getCheckpointReward({ counts, kind }),
      sections: size.sections,
      // The exam's real start time when it has one, else the time the learner's own words gave.
      startTime: size.startTime ?? goal.studyTime,
      status: getAvailableChallengeStatus({
        block,
        call,
        isMock,
        questions: size.questions,
        status,
      }),
      timeZone: size.startTime ? size.timeZone : null,
      title: item.titleSnapshot,
      today: toIsoDate(today),
      topics,
      written: size.written,
      wrongPenalty: isMock
        ? getWrongPenalty(
            goal.examBlueprint ? readBlueprintContent(goal.examBlueprint).structure : null,
          )
        : 0,
    },
    status: "ready",
  };
}
