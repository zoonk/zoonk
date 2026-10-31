import "server-only";
import { countFinishedMocksBefore } from "../../exams/mocks/_utils/mock-number";
import { loadMockPace } from "../../exams/mocks/_utils/mock-pace";
import { getMock } from "../../exams/mocks/get-mock";
import { readMockWrittenParts } from "../../exams/mocks/mock-left-out";
import { estimateMockMinutes } from "../../exams/mocks/mock-options";
import { CHECKPOINT_CALL_BLOCK_MINUTES } from "../../language/conversations/conversation-rules";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { countAskableQuestions } from "../../sessions/_utils/askable-questions";
import { readBlockPayload } from "../../sessions/block-payload";
import { type ChallengeSection, type ChallengeView } from "../challenge-contract";
import { getCheckpointMinutes } from "../checkpoint-minutes";
import { CHECKPOINT_QUESTIONS, getPlannedQuestions } from "../checkpoint-rules";
import { getOfferQuestions, readBossOffer } from "./challenge-offer";
import { loadMockCard } from "./mock-card";
import { type ChallengeBlock, type OwnedChallenge, isLanguageCall } from "./owned-challenge";

type ChallengeSize = {
  estimatedMinutes: number | null;
  fullLength: boolean;
  minutes: number | null;
  written: ChallengeView["written"];
  leftOut: ChallengeView["leftOut"];
  netScored: boolean;
  number: number | null;
  questions: number | null;
  sections: ChallengeSection[];
  startTime: string | null;
  timeZone: string | null;
};

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

async function loadCheckpointSize(block: ChallengeBlock): Promise<ChallengeSize> {
  const payload = readBlockPayload(block);
  const itemIds = payload.itemIds;

  if (block.status === "active") {
    return getCheckpointSize(
      await countAskableQuestions({
        answeredItemIds: payload.checkpointAnswers.map((answer) => answer.itemId),
        itemIds,
      }),
    );
  }

  return getCheckpointSize(getPlannedQuestions(itemIds.length));
}

function getCheckpointSize(questions: number | null): ChallengeSize {
  const minutes = questions === null ? null : getCheckpointMinutes(questions);

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

const CALL_SIZE: ChallengeSize = {
  ...getCheckpointSize(CHECKPOINT_QUESTIONS),
  estimatedMinutes: CHECKPOINT_CALL_BLOCK_MINUTES,
  minutes: CHECKPOINT_CALL_BLOCK_MINUTES,
  questions: 0,
};

export function loadChallengeSize({
  block,
  challenge,
}: {
  block: ChallengeBlock | null;
  challenge: OwnedChallenge;
}): ChallengeSize | Promise<ChallengeSize> {
  if (challenge.item.kind === "mock") {
    return loadMockSize({ block, challenge });
  }

  if (isLanguageCall(challenge)) {
    return CALL_SIZE;
  }

  return block ? loadCheckpointSize(block) : getOfferSize(challenge);
}

function getOfferSize(challenge: OwnedChallenge): ChallengeSize {
  const offer = readBossOffer(challenge);
  const questions = getOfferQuestions(offer);

  if (questions === null) {
    return getCheckpointSize(null);
  }

  const minutes = offer?.waiting ? 0 : (offer?.minutes ?? 0);
  return { ...getCheckpointSize(questions), estimatedMinutes: minutes, minutes };
}
