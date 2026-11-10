import "server-only";
import { type StudySessionBlock } from "@zoonk/db";
import { getExamName } from "../exams/exam-name";
import { getWrongPenalty } from "../exams/scoring/mock-scoring";
import { readChallengeResults } from "../learner/facts/challenge-results";
import { readTodayPlanSession } from "../learner/facts/today-plan-session";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { loadMilestoneCounts } from "../milestones/award-milestones";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { type PlanEffect } from "../plans/planner/plan-effect";
import { parsePlanPhases, parsePlanSettings } from "../plans/planner/plan-state";
import { previewTodayBlocks } from "../sessions/_utils/read-study-day";
import { type StudySessionRow } from "../sessions/_utils/study-session-access";
import { readBlockPayload } from "../sessions/block-payload";
import { getStoredBlockWait } from "../sessions/block-wait";
import { type CheckpointKind } from "../sessions/brain-power";
import { type StudySessionTimeZoneInput } from "../sessions/contract";
import { countBlockRecordings } from "./_utils/boss-recordings";
import { getAvailableChallengeStatus } from "./_utils/challenge-availability";
import { loadChallengeCall } from "./_utils/challenge-call";
import { readTodayBlockStatus } from "./_utils/challenge-day";
import { canMoveToMonday, loadChallengeMoveRules, loadMoveEffect } from "./_utils/challenge-move";
import { readBossOffer } from "./_utils/challenge-offer";
import { needsPlus } from "./_utils/challenge-plus";
import { isChallengeReached } from "./_utils/challenge-reach";
import { loadChallengeSize } from "./_utils/challenge-size";
import { getChallengeStatus } from "./_utils/challenge-status";
import { getChallengeTimings } from "./_utils/challenge-timing";
import { getWaitingTiming } from "./_utils/challenge-timing-view";
import { loadChallengeTopics } from "./_utils/challenge-topics";
import { getAskablePassMark } from "./_utils/checkpoint-outcome";
import { loadResultReinforcement } from "./_utils/checkpoint-reinforcement";
import { type CheckpointResult } from "./_utils/checkpoint-results";
import { isFinalBoss } from "./_utils/load-boss";
import { isWeeklyChallengeItem } from "./_utils/load-weekly-challenge";
import {
  type ChallengeBlock,
  type OwnedChallenge,
  findChallengeBlock,
  findOwnedChallenge,
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

function getSavedChallengeBlock({
  planItemId,
  session,
}: {
  planItemId: string;
  session: StudySessionRow | null;
}): ChallengeBlock | null {
  const block = session?.blocks.find((row) => readBlockPayload(row).planItemId === planItemId);
  return block && session ? { ...block, session } : null;
}

function getChallengePassMark({
  block,
  call,
  kind,
  size,
}: {
  block: Pick<StudySessionBlock, "payload"> | null;
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

function isOfferedBeforeOpen({
  challenge,
  heldToday,
  plusRequired,
}: {
  challenge: OwnedChallenge;
  heldToday: boolean;
  plusRequired: boolean;
}): boolean {
  return heldToday && !plusRequired && challenge.goal.status === "active";
}

/** The day Today plans while Start hasn't built today; only a phase challenge's offer reads it. */
function previewChallengeDay(challenge: OwnedChallenge) {
  const { goal, item, timeZone, userId } = challenge;

  return item.kind === "boss" && item.status === "todo"
    ? previewTodayBlocks(userId, goal.id, timeZone)
    : [];
}

async function loadChallengeDay(challenge: OwnedChallenge) {
  const { goal, item, timeZone, today, userId } = challenge;
  const savedDayRead = readTodayPlanSession(userId, goal.id, timeZone);

  const [results, plusRequired, block, savedDay, previewBlocks] = await Promise.all([
    item.kind === "boss"
      ? readChallengeResults(
          userId,
          challenge.items.flatMap((entry) => (entry.kind === "boss" ? [entry.id] : [])),
        )
      : Promise.resolve(new Map<string, CheckpointResult>()),
    needsPlus(challenge),
    findChallengeBlock({ challenge }),
    savedDayRead,
    savedDayRead.then((saved) => (saved ? [] : previewChallengeDay(challenge))),
  ]);

  const todayBlocks = savedDay?.blocks ?? previewBlocks;

  const due =
    item.kind === "boss"
      ? isChallengeReached({ boss: item, items: challenge.items })
      : item.scheduledFor !== null && item.scheduledFor <= today && item.status === "todo";

  const timing =
    item.kind === "boss"
      ? getChallengeTimings({
          goal,
          items: challenge.items,
          results,
          settings: parsePlanSettings(challenge.plan.settings),
          today,
          todayBlocks,
          todaySessionDate: savedDay?.localDate,
        }).get(item.id)
      : null;

  const todayBlock = getSavedChallengeBlock({ planItemId: item.id, session: savedDay });

  const offered =
    !savedDay &&
    isOfferedBeforeOpen({
      challenge,
      heldToday: item.kind === "boss" ? timing?.when === "nextSession" : due,
      plusRequired,
    });

  const status = getChallengeStatus({
    due,
    itemStatus: item.status,
    plusRequired,
    todayBlockStatus: offered
      ? "pending"
      : await readTodayBlockStatus({ isMock: item.kind === "mock", todayBlock }),
  });

  const heldBlock = todayBlock ?? previewBlocks.find((row) => row.payload.planItemId === item.id);

  return {
    ...getWaitingTiming({ challenge, due, status, timing }),
    lastResult: results.get(item.id) ?? null,
    plannedBlock: offered ? heldBlock : undefined,
    plusRequired,
    previewBlock: offered ? null : (todayBlock ?? block),
    todayBlock,
    waitReason: heldBlock ? getStoredBlockWait({ block: heldBlock, blocks: todayBlocks }) : null,
  };
}

function loadRecordings({
  block,
  challenge,
}: {
  block: Pick<StudySessionBlock, "payload"> | null;
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

  const {
    date,
    lastResult,
    plannedBlock,
    plusRequired,
    previewBlock,
    status,
    todayBlock,
    waitReason,
  } = await loadChallengeDay(challenge);

  const blockId = getOpenBlockId({ block: previewBlock, todayBlock });
  const questionBlock = plannedBlock ?? previewBlock;

  const [size, canMoveIt, counts, recordings, topics, call, moved] = await Promise.all([
    loadChallengeSize({ block: previewBlock, challenge, plannedBlock }),
    status !== "plusRequired" && canMove({ challenge, todayBlock }),
    loadMilestoneCounts(userId),
    loadRecordings({ block: questionBlock, challenge }),
    loadChallengeTopics({ block: questionBlock, challenge }),
    loadChallengeCall({ blockId, challenge }),
    movedBy ? loadMoveEffect({ changeId: movedBy, planId: item.planId }) : null,
  ]);

  const reinforcement = await loadResultReinforcement({ result: lastResult, userId });
  const shown = getAvailableChallengeStatus({ block: previewBlock, call, isMock, size, status });

  return {
    challenge: {
      blockId,
      call,
      canMove: canMoveIt,
      date,
      estimatedMinutes: size.estimatedMinutes,
      examName: isMock ? getExamName({ blueprint: goal.examBlueprint, goal }) : null,
      fullLength: size.fullLength,
      goalId: goal.id,
      kind,
      leftOut: size.leftOut,
      locked: plusRequired,
      minutes: size.minutes,
      mock: isMock,
      netScored: size.netScored,
      number: size.number,
      passMark: getChallengePassMark({ block: questionBlock, call, kind, size }),
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
