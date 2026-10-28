import "server-only";
import { type Attempt, type StudySessionBlock, prisma } from "@zoonk/db";
import { isBlockDuelDecided } from "../checkpoints/_utils/checkpoint-outcome";
import { loadCheckpointReinforcement } from "../checkpoints/_utils/checkpoint-reinforcement";
import { loadSkillsToRelearn } from "../learner/_utils/load-skill-claims";
import { gradeTypedItemAnswer } from "../learner/_utils/typed-grading";
import { ITEM_IMAGE_INCLUDE } from "../library/items/item-image";
import { ITEM_SET_INCLUDE } from "../library/items/item-sets";
import { applyDrillRules } from "../mistakes/drill-answer";
import { isLeftBlank } from "./_utils/net-score";
import { recordStudyAnswer } from "./_utils/record-study-answer";
import { getBlockAnswers, loadSessionAnswers } from "./_utils/session-answers";
import {
  type GradedSessionAnswer,
  type SessionItem,
  gradeSessionAnswer,
  parseSessionItem,
  readRecordedAnswer,
} from "./_utils/session-items";
import { loadAnsweredTranscript } from "./_utils/set-transcript";
import { type StudySessionRow, findOwnedStudyBlock } from "./_utils/study-session-access";
import { getBlockItemIds, readBlockPayload } from "./block-payload";
import { getHyperdriveLevel, scoreAnswers } from "./brain-power";
import { type StudyAnswerInput, type StudyAnswerResult } from "./contract";
import { shouldSuggestPause } from "./pause-suggestion";

/** Placement misses can restore lessons skipped after a single correct answer, even when practice confirmed once. */
async function isRelearnMiss({
  isCorrect,
  item,
  session,
}: {
  isCorrect: boolean;
  item: SessionItem;
  session: StudySessionRow;
}): Promise<boolean> {
  if (isCorrect || !session.goalId || !item.skillId) {
    return false;
  }

  const taken = await loadSkillsToRelearn({
    goalId: session.goalId,
    skillIds: [item.skillId],
    userId: session.userId,
  });

  return taken.has(item.skillId);
}

/** Replays use the stored answer and avoid grading a changed typed submission with a model. */
function getStoredCheckpointAnswer({
  block,
  previous,
}: {
  block: StudySessionBlock;
  previous: Attempt | null;
}) {
  if (block.kind !== "checkpoint" || !previous) {
    return null;
  }

  return readRecordedAnswer(previous.answer);
}

/** A completed checkpoint still acknowledges a retry of an answer it already stored. */
function canAnswerBlock(block: StudySessionBlock): boolean {
  return block.status === "active" || (block.kind === "checkpoint" && block.status === "completed");
}

async function loadAnswerReinforcement({
  block,
  userId,
}: {
  block: StudySessionBlock;
  userId: string;
}): Promise<number | null> {
  if (block.kind !== "checkpoint") {
    return null;
  }

  const lessons = await loadCheckpointReinforcement({ block, userId });
  return lessons.length;
}

async function gradeStudyAnswer({
  answer,
  blockId,
  item,
  session,
  userId,
}: {
  answer: StudyAnswerInput["answer"];
  blockId: string;
  item: SessionItem;
  session: StudySessionRow;
  userId: string;
}): Promise<GradedSessionAnswer> {
  const graded = gradeSessionAnswer({ answer, blockId, item });

  if (item.format !== "typed" || graded.isCorrect || !("text" in answer)) {
    return graded;
  }

  const verdict = await gradeTypedItemAnswer({
    item,
    practicedLanguage: session.goal?.targetLanguage ?? null,
    text: answer.text,
    userId,
  });

  return {
    ...graded,
    explanation: verdict.feedback,
    isCorrect: verdict.isCorrect,
    snapshot: { ...graded.snapshot, explanation: verdict.feedback },
  };
}

/** Requires an owned session; diagnostic placement avoids notebook entries, while blank net-scored statements are not mistakes. */
export async function answerStudyQuestion({
  blockId,
  input,
  sessionId,
}: {
  blockId: string;
  input: StudyAnswerInput;
  sessionId: string;
}): Promise<StudyAnswerResult> {
  const owned = await findOwnedStudyBlock({ blockId, sessionId });

  if (owned.status !== "ready") {
    return owned;
  }

  const { block, session, userId } = owned;
  const payload = readBlockPayload(block);

  if (!canAnswerBlock(block)) {
    return { status: "blockNotActive" };
  }

  // Mock answers belong to the mock screen's saveMockAnswer flow.
  if (payload.checkpoint?.mock || !getBlockItemIds(payload).includes(input.itemId)) {
    return { status: "invalidItem" };
  }

  const [row, previous] = await Promise.all([
    prisma.item.findUnique({
      include: { ...ITEM_IMAGE_INCLUDE, ...ITEM_SET_INCLUDE },
      where: { id: input.itemId },
    }),
    prisma.attempt.findFirst({
      orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
      where: { itemId: input.itemId, studySessionId: sessionId, userId },
    }),
  ]);

  const item = row ? parseSessionItem(row) : null;

  if (!row || !item) {
    return { status: "invalidItem" };
  }

  if (previous && block.kind !== "checkpoint") {
    return { status: "alreadyAnswered" };
  }

  const storedAnswer = getStoredCheckpointAnswer({ block, previous });

  const graded = storedAnswer
    ? gradeSessionAnswer({ answer: storedAnswer, blockId: block.id, item })
    : await gradeStudyAnswer({ answer: input.answer, blockId: block.id, item, session, userId });

  const drill = payload.drills.find((candidate) => candidate.itemIds.includes(item.id));

  const drilled = applyDrillRules({
    dontKnow: "dontKnow" in input.answer,
    drill: drill ?? null,
    durationMs: input.durationMs,
    isCorrect: graded.isCorrect,
    misconception: graded.snapshot.misconception ?? null,
  });

  const blank = isLeftBlank({ answer: input.answer, itemId: item.id, payload });
  const placement = payload.placementItemIds.includes(item.id);

  const result = await recordStudyAnswer({
    blank,
    block,
    drill,
    drilled,
    format: row.format,
    graded,
    input,
    item,
    placement,
    relearn: await isRelearnMiss({ isCorrect: drilled.isCorrect, item, session }),
    session,
    sessionId,
    userId,
  });

  if (result.status !== "ready") {
    return result;
  }

  const { recorded } = result;
  const answers = await loadSessionAnswers({ blocks: session.blocks, sessionId, userId });

  const isCheckpoint = block.kind === "checkpoint";

  const [transcript, reinforcementLessons] = await Promise.all([
    loadAnsweredTranscript({
      blockItemIds: getBlockItemIds(payload),
      duelOver: isBlockDuelDecided({ answers: getBlockAnswers({ answers, block }), payload }),
      itemId: item.id,
      sessionId,
      setId: row.setId,
      userId,
    }),
    loadAnswerReinforcement({ block, userId }),
  ]);

  const { streak } = scoreAnswers({ answers });

  return {
    feedback: {
      blank: isLeftBlank({ answer: recorded.attempt.answer, itemId: item.id, payload }),
      correctAnswer: isCheckpoint ? null : graded.correctAnswer,
      explanation: isCheckpoint ? null : graded.explanation,
      hyperdrive: { level: getHyperdriveLevel(streak), streak },
      isCorrect: recorded.attempt.isCorrect,
      mistakeFixed: drill !== undefined && recorded.fixedMistakeIds.includes(drill.mistakeId),
      pauseSuggested: shouldSuggestPause(answers.map((answer) => answer.isCorrect)),
      reinforcementLessons,
      savedToNotebook: recorded.mistake !== null,
      transcript,
      trap: isCheckpoint ? null : drilled.trap,
      workedSteps: isCheckpoint ? [] : graded.workedSteps,
    },
    status: "ready",
  };
}
