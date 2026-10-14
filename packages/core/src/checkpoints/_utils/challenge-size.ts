import "server-only";
import { buildMockConditions } from "../../exams/mocks/_utils/mock-conditions";
import { countFinishedMocksBefore } from "../../exams/mocks/_utils/mock-number";
import { loadMockPace } from "../../exams/mocks/_utils/mock-pace";
import { getAskedItemIds } from "../../exams/mocks/_utils/mock-sections";
import { loadAskedTypedParts } from "../../exams/mocks/_utils/mock-typed-parts";
import { getMock } from "../../exams/mocks/get-mock";
import { listSatMockLeftOut, readMockWrittenParts } from "../../exams/mocks/mock-left-out";
import { estimateMockMinutes } from "../../exams/mocks/mock-options";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../../language/conversations/conversation-rules";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { countAskableQuestions } from "../../sessions/_utils/askable-questions";
import { readBlockPayload } from "../../sessions/block-payload";
import { type PlannedBlock } from "../../sessions/session-builder";
import { type ChallengeSection, type ChallengeView } from "../challenge-contract";
import { getCheckpointMinutes } from "../checkpoint-minutes";
import { CHECKPOINT_QUESTIONS, getPlannedQuestions } from "../checkpoint-rules";
import { planBossSize } from "./challenge-topics";
import { loadMockCard } from "./mock-card";
import { type ChallengeBlock, type OwnedChallenge, isLanguageCall } from "./owned-challenge";

/** What a challenge asks and how long it takes, as its intro says it. */
type ChallengeSize = {
  estimatedMinutes: number;
  fullLength: boolean;
  minutes: number;
  written: ChallengeView["written"];
  leftOut: ChallengeView["leftOut"];
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
  planned,
}: {
  block: ChallengeBlock | null;
  challenge: OwnedChallenge;
  planned?: PlannedBlock | null;
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
      leftOut: mock.leftOut,
      minutes: mock.minutes,
      netScored: mock.scoring === "net",
      number: mock.number,
      questions: mock.questions,
      sections: mock.sections.flatMap(({ index, minutes, name, questions, tools }) =>
        questions > 0 ? [{ index, minutes, name, questions, tools }] : [],
      ),
      startTime: mock.startTime,
      timeZone: mock.timeZone,
      written: readMockWrittenParts({
        day: mock.day,
        essays: mock.sections.reduce((sum, section) => sum + section.essays, 0),
        fullLength: mock.fullLength,
        structure: challenge.goal.examBlueprint
          ? readBlueprintContent(challenge.goal.examBlueprint).structure
          : null,
      }),
    };
  }

  if (planned) {
    return loadPreviewMockSize({ challenge, pace, planned });
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
    leftOut: card.conditions.leftOut,
    minutes: card.conditions.timeLimitMinutes,
    netScored: card.conditions.netScoring,
    number: finished + 1,
    questions: card.conditions.questions,
    sections: card.conditions.sections.flatMap(({ minutes, name, questions, tools }, index) =>
      minutes && questions ? [{ index, minutes, name, questions, tools }] : [],
    ),
    startTime: card.startTime,
    timeZone: card.startTime ? card.timeZone : null,
    written: card.conditions.written,
  };
}

/** The unstarted intro reads the same conditions that Start will persist, without inventing a block. */
async function loadPreviewMockSize({
  challenge,
  pace,
  planned,
}: {
  challenge: OwnedChallenge;
  pace: Awaited<ReturnType<typeof loadMockPace>>;
  planned: PlannedBlock;
}): Promise<ChallengeSize> {
  const { goal, today, userId } = challenge;
  const structure = goal.examBlueprint ? readBlueprintContent(goal.examBlueprint).structure : null;

  const conditions = await buildMockConditions({
    blueprint: goal.examBlueprint,
    goal,
    payload: planned.payload,
    sessionDate: today,
    structure,
    userId,
  });

  const [finished, typed] = await Promise.all([
    countFinishedMocksBefore({ goalId: goal.id }),
    loadAskedTypedParts(getAskedItemIds(conditions).map((entry) => entry.itemId)),
  ]);

  const minutes = conditions.sections.reduce((sum, section) => sum + section.minutes, 0);
  const questions = conditions.sections.reduce((sum, section) => sum + section.questions, 0);

  return {
    estimatedMinutes: estimateMockMinutes({ minutes, pace, questions }),
    fullLength: conditions.fullLength,
    leftOut: listSatMockLeftOut({ conditions, structure, typed }),
    minutes,
    netScored: conditions.scoring === "net",
    number: finished + 1,
    questions,
    sections: conditions.sections.flatMap(
      ({ minutes: time, name, questions: count, tools }, index) =>
        count > 0 ? [{ index, minutes: time, name, questions: count, tools: tools ?? null }] : [],
    ),
    startTime: conditions.startTime,
    timeZone: conditions.startTime ? conditions.timeZone : null,
    written: readMockWrittenParts({
      day: conditions.day,
      essays: conditions.sections.reduce((sum, section) => sum + section.essays.length, 0),
      fullLength: conditions.fullLength,
      structure,
    }),
  };
}

/**
 * A checkpoint's questions: its saved or preview payload's, or about ten before its day and while its block waits
 * for the questions it starts by writing (`getPlannedQuestions`). A started one asks what the bank
 * still holds of them (`countAskableQuestions`), as its duel does.
 */
async function loadCheckpointSize({
  block,
  planned,
}: {
  block: ChallengeBlock | null;
  planned?: PlannedBlock | null;
}): Promise<ChallengeSize> {
  const payload = block ? readBlockPayload(block) : planned?.payload;
  const itemIds = payload?.itemIds ?? [];

  if (block?.status === "active") {
    return getCheckpointSize(
      await countAskableQuestions({
        answeredItemIds: payload?.checkpointAnswers.map((answer) => answer.itemId),
        itemIds,
      }),
    );
  }

  return getCheckpointSize(payload ? getPlannedQuestions(itemIds.length) : CHECKPOINT_QUESTIONS);
}

function getCheckpointSize(questions: number): ChallengeSize {
  const minutes = getCheckpointMinutes(questions);

  return {
    estimatedMinutes: minutes,
    fullLength: false,
    leftOut: [],
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

/** A unit's call asks no questions: its block is the call with its intro and feedback. */
const CALL_SIZE: ChallengeSize = {
  ...getCheckpointSize(CHECKPOINT_QUESTIONS),
  estimatedMinutes: CHECKPOINT_CALL_BLOCK_MINUTES,
  minutes: CHECKPOINT_CALL_BLOCK_MINUTES,
  questions: 0,
};

export function loadChallengeSize({
  block,
  challenge,
  planned,
}: {
  block: ChallengeBlock | null;
  challenge: OwnedChallenge;
  planned?: PlannedBlock | null;
}): ChallengeSize | Promise<ChallengeSize> {
  if (challenge.item.kind === "mock") {
    return loadMockSize({ block, challenge, planned });
  }

  if (isLanguageCall(challenge)) {
    return CALL_SIZE;
  }

  return challenge.item.kind === "boss" && !block && !planned
    ? loadPlannedBossSize(challenge)
    : loadCheckpointSize({ block, planned });
}

/**
 * A phase's checkpoint before its block is built, as the plan keeps it (`planBossSize`): none
 * while it can't be asked yet, which waits with no time of its own.
 */
async function loadPlannedBossSize(challenge: OwnedChallenge): Promise<ChallengeSize> {
  const size = await planBossSize(challenge);
  return size ? getCheckpointSize(size.questions) : { ...getCheckpointSize(0), questions: 0 };
}
