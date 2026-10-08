import "server-only";
import { getAllowance } from "../entitlements/get-allowance";
import { countFinishedMocksBefore } from "../exams/mocks/_utils/mock-number";
import { loadMockPace } from "../exams/mocks/_utils/mock-pace";
import { getMock } from "../exams/mocks/get-mock";
import { estimateMockMinutes } from "../exams/mocks/mock-options";
import { outlineMock } from "../exams/mocks/mock-plan";
import { readBlueprintContent } from "../library/exams/save-exam-blueprint";
import { loadMilestoneCounts } from "../milestones/award-milestones";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { parsePlanPhases } from "../plans/planner/plan-state";
import { getExamPrepAccess } from "../sessions/_utils/exam-access";
import { readBlockPayload } from "../sessions/block-payload";
import { type CheckpointKind } from "../sessions/brain-power";
import { type StudySessionTimeZoneInput } from "../sessions/contract";
import { ensureStudySession } from "../sessions/ensure-study-session";
import { getMovableDay, loadChallengeMoveRules } from "./_utils/challenge-move";
import { getChallengeStatus } from "./_utils/challenge-status";
import { findLastCheckpointResult } from "./_utils/checkpoint-results";
import { isBossReached, isFinalBoss } from "./_utils/load-boss";
import { isWeeklyChallengeItem } from "./_utils/load-weekly-challenge";
import { loadMockCard } from "./_utils/mock-card";
import {
  type ChallengeBlock,
  type OwnedChallenge,
  findChallengeBlock,
  findOwnedChallenge,
  getTodayBlock,
} from "./_utils/owned-challenge";
import { type ChallengeSection, type ChallengeView } from "./challenge-contract";
import { getCheckpointReward } from "./checkpoint-reward";
import {
  CHECKPOINT_MINUTES_PER_QUESTION,
  CHECKPOINT_QUESTIONS,
  REINFORCEMENT_LESSONS,
  getPassMark,
} from "./checkpoint-rules";

export type ChallengeResult =
  | { challenge: ChallengeView; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

type ChallengeSize = {
  estimatedMinutes: number;
  fullLength: boolean;
  minutes: number;
  written: ChallengeView["written"];
  netScored: boolean;
  number: number | null;
  questions: number;
  sections: ChallengeSection[];
  startTime: string | null;
  timeZone: string | null;
};

/** A mock as its block fixed it, or, before its day, as the exam's conditions plan it now. */
async function loadMockSize({
  block,
  challenge,
}: {
  block: ChallengeBlock | null;
  challenge: OwnedChallenge;
}): Promise<ChallengeSize> {
  const [fixed, pace] = await Promise.all([
    block ? getMock(block.id) : null,
    loadMockPace(challenge.goal.examBlueprintId),
  ]);

  if (fixed?.status === "ready") {
    const { mock } = fixed;

    return {
      estimatedMinutes: estimateMockMinutes({ ...mock, pace }),
      fullLength: mock.fullLength,
      minutes: mock.minutes,
      netScored: mock.scoring === "net",
      number: mock.number,
      questions: mock.questions,
      sections: mock.sections.map(({ index, minutes, name, questions }) => ({
        index,
        minutes,
        name,
        questions,
      })),
      startTime: mock.startTime,
      timeZone: mock.timeZone,
      written: outlineMock({
        fullLength: mock.fullLength,
        structure: challenge.goal.examBlueprint
          ? readBlueprintContent(challenge.goal.examBlueprint).structure
          : null,
      }).written,
    };
  }

  const { goal, item, today } = challenge;

  const [card, finished] = await Promise.all([
    loadMockCard({ blueprint: goal.examBlueprint, date: item.scheduledFor ?? today, goal, today }),
    countFinishedMocksBefore({ goalId: goal.id }),
  ]);

  return {
    estimatedMinutes: estimateMockMinutes({
      minutes: card.conditions.timeLimitMinutes,
      pace,
      questions: card.conditions.questions,
    }),
    fullLength: card.conditions.fullLength,
    minutes: card.conditions.timeLimitMinutes,
    netScored: card.conditions.netScoring,
    number: finished + 1,
    questions: card.conditions.questions,
    sections: card.conditions.sections.flatMap(({ minutes, name, questions }, index) =>
      minutes && questions ? [{ index, minutes, name, questions }] : [],
    ),
    startTime: card.startTime,
    timeZone: card.startTime ? card.timeZone : null,
    written: card.conditions.written,
  };
}

/** A checkpoint's questions: its block's, or about ten before its day. */
function getCheckpointSize(block: ChallengeBlock | null): ChallengeSize {
  const questions = block ? readBlockPayload(block).itemIds.length : CHECKPOINT_QUESTIONS;
  const minutes = Math.round(questions * CHECKPOINT_MINUTES_PER_QUESTION);

  return {
    estimatedMinutes: minutes,
    fullLength: false,
    minutes,
    netScored: false,
    number: null,
    questions,
    sections: [],
    startTime: null,
    timeZone: null,
    written: [],
  };
}

function getKind(challenge: OwnedChallenge): CheckpointKind {
  if (isWeeklyChallengeItem(challenge.item)) {
    return "weekly";
  }

  return isFinalBoss({ boss: challenge.item, items: challenge.items }) ? "finalBoss" : "boss";
}

function isDue(challenge: OwnedChallenge): boolean {
  const { item, items, today } = challenge;

  if (item.kind === "boss") {
    return isBossReached({ boss: item, items, today });
  }

  return item.scheduledFor !== null && item.scheduledFor <= today;
}

/** An exam's weekly mock is a Plus feature: the free plan says so instead of hiding it. */
async function needsPlus(challenge: OwnedChallenge): Promise<boolean> {
  if (challenge.item.kind !== "mock") {
    return false;
  }

  const allowance = await getAllowance();

  return !getExamPrepAccess({
    examPrep: allowance?.examPrep ?? null,
    goal: challenge.goal,
    timeZone: challenge.timeZone,
    today: challenge.today,
  }).includesMockExams;
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

/** Right answers that win a phase checkpoint: its block's, or seven of ten before it's planned. */
function getChallengePassMark({
  block,
  kind,
  questions,
}: {
  block: ChallengeBlock | null;
  kind: CheckpointKind;
  questions: number;
}): number | null {
  if (kind === "weekly") {
    return null;
  }

  return (block ? readBlockPayload(block).checkpoint?.passMark : null) ?? getPassMark(questions);
}

/**
 * Where the challenge stands today. On its day, today's session is planned first (as Today plans
 * it), so the intro says exactly what it asks, or that the day was planned without it.
 */
async function loadChallengeDay(challenge: OwnedChallenge) {
  const { goal, item, timeZone, today, userId } = challenge;
  const due = isDue(challenge) && item.status === "todo";
  const plusRequired = item.status === "todo" && (await needsPlus(challenge));

  if (due && !plusRequired && goal.status === "active") {
    await ensureStudySession({ goal, localDate: today, timeZone, userId });
  }

  const block = await findChallengeBlock({ challenge });
  const todayBlock = getTodayBlock({ block, today });

  const status = getChallengeStatus({
    due,
    itemStatus: item.status,
    plusRequired,
    todayBlockStatus: todayBlock?.status ?? null,
  });

  return { block, status, todayBlock };
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
  const { block, status, todayBlock } = await loadChallengeDay(challenge);

  const [size, canMoveIt, lastResult, counts] = await Promise.all([
    isMock ? loadMockSize({ block, challenge }) : getCheckpointSize(block),
    // A mock the plan doesn't include has no day of its own to move.
    status !== "plusRequired" && canMove({ challenge, todayBlock }),
    kind === "weekly" ? null : findLastCheckpointResult({ planItemId: item.id, userId }),
    loadMilestoneCounts(userId),
  ]);

  return {
    challenge: {
      blockId: getOpenBlockId({ block, todayBlock }),
      call: goal.kind === "language" && item.kind === "boss",
      canMove: canMoveIt,
      date: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
      estimatedMinutes: size.estimatedMinutes,
      examName: isMock ? (goal.examBlueprint?.name ?? goal.title) : null,
      fullLength: size.fullLength,
      goalId: goal.id,
      kind,
      minutes: size.minutes,
      mock: isMock,
      netScored: size.netScored,
      number: size.number,
      passMark: getChallengePassMark({ block, kind, questions: size.questions }),
      phase: findPhase(challenge),
      planItemId: item.id,
      questions: size.questions,
      reinforcementLessons: REINFORCEMENT_LESSONS,
      // A new try is one after a day that didn't pass; today's is "tried" until tomorrow.
      rematch: Boolean(lastResult && !lastResult.passed && lastResult.localDate < today),
      reward: getCheckpointReward({ counts, kind }),
      sections: size.sections,
      // The exam's real start time when it has one, else the time the learner's own words gave.
      startTime: size.startTime ?? goal.studyTime,
      status,
      timeZone: size.startTime ? size.timeZone : null,
      title: item.titleSnapshot,
      today: toIsoDate(today),
      written: size.written,
    },
    status: "ready",
  };
}
