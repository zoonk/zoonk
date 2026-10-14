import "server-only";
import { prisma } from "@zoonk/db";
import { io } from "next/cache";
import {
  getCheckpointQuestionCount,
  restoreCheckpointAnswers,
} from "../checkpoints/_utils/checkpoint-answer-evidence";
import { getAskablePassMark, isBlockDuelDecided } from "../checkpoints/_utils/checkpoint-outcome";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { loadBlockedTestOutChapters } from "../learner/test-out/_utils/offer-eligibility";
import { readNoticeFormats } from "../library/exams/notice-formats";
import { type TrueFalseLabels, getTrueFalseLabels } from "../library/exams/true-false-labels";
import { isQuotedItem } from "../library/items/item-content";
import { ITEM_IMAGE_INCLUDE } from "../library/items/item-image";
import { ITEM_SET_INCLUDE, toItemSetView } from "../library/items/item-sets";
import { citedSourceSelect, toItemCitation } from "../library/sources/source-citation";
import { loadDrillLessons, toDrillView } from "../mistakes/drill-lessons";
import { loadExamStructure } from "./_utils/exam-structure";
import { isLeftBlank } from "./_utils/net-score";
import {
  type SessionItem,
  describeEarlierAnswer,
  parseSessionItem,
  toSessionQuestion,
} from "./_utils/session-items";
import { type StudyBlockView, toStudyBlockView } from "./_utils/session-view";
import { findOwnedStudyBlock } from "./_utils/study-session-access";
import { type BlockPayload, getBlockItemIds, readBlockPayload } from "./block-payload";
import { type StudyBlockQuestion, type TimeMachine } from "./study-block-question";

type StudyBlockDetail = {
  /** Verdicts of asked checkpoint questions, including questions whose content was removed. */
  answeredQuestions?: { isCorrect: boolean; itemId: string }[];
  block: StudyBlockView;
  /** Checkpoints are duels without hints, explanations or the tutor until they end. */
  hints: boolean;
  questions: StudyBlockQuestion[];
  /** The words the goal's true-or-false statements are answered with, by its exam. */
  trueFalseLabels: TrueFalseLabels;
};

export type StudyBlockResult =
  | { detail: StudyBlockDetail; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function loadTimeMachines({
  blockId,
  items,
  payload,
  sessionId,
  userId,
}: {
  blockId: string;
  items: readonly SessionItem[];
  payload: BlockPayload;
  sessionId: string;
  userId: string;
}): Promise<Map<string, TimeMachine>> {
  const capsuleItemIds = payload.capsules.flatMap((capsule) => capsule.itemIds);

  const earlier = await prisma.attempt.findMany({
    distinct: ["itemId"],
    orderBy: [{ itemId: "asc" }, { answeredAt: "desc" }],
    select: { answer: true, answeredAt: true, isCorrect: true, itemId: true },
    where: {
      OR: [{ studySessionId: null }, { studySessionId: { not: sessionId } }],
      itemId: { in: capsuleItemIds },
      userId,
    },
  });

  return new Map(
    earlier.flatMap((attempt) => {
      const item = items.find((candidate) => candidate.id === attempt.itemId);

      return item
        ? [
            [
              item.id,
              {
                answer: attempt.isCorrect
                  ? null
                  : describeEarlierAnswer({ answer: attempt.answer, blockId, item }),
                answeredAt: attempt.answeredAt,
                isCorrect: attempt.isCorrect,
              },
            ] as const,
          ]
        : [];
    }),
  );
}

/**
 * A started checkpoint the bank shortened (a question removed since it started) as it can still be
 * played: the questions it shows and their pass mark (`getAskablePassMark`), as its own screen and
 * settlement read them. One waiting for its questions keeps its planned size.
 */
function toAskableBlock({
  block,
  payload,
  questions,
}: {
  block: StudyBlockView;
  payload: BlockPayload;
  questions: number;
}): StudyBlockView {
  if (!block.checkpoint || block.status === "pending" || questions >= block.questions) {
    return block;
  }

  return {
    ...block,
    checkpoint: { ...block.checkpoint, passMark: getAskablePassMark({ payload, questions }) },
    questions,
  };
}

/**
 * A question block with its questions, never their answers: capsules with their time machine
 * lines, mistake drills, practice and checkpoint questions, and which ones were answered already
 * so the block resumes where the learner left it. Lesson blocks are played in the lesson player.
 */
export async function getStudyBlock({
  blockId,
  sessionId,
}: {
  blockId: string;
  sessionId: string;
}): Promise<StudyBlockResult> {
  const owned = await findOwnedStudyBlock({ blockId, sessionId });

  if (owned.status !== "ready") {
    return owned;
  }

  const payload = readBlockPayload(owned.block);
  const itemIds = getBlockItemIds(payload);

  await io();

  const [rows, storedAnswers, drillLessons, structure, blockedTestOutChapters] = await Promise.all([
    prisma.item.findMany({
      include: {
        ...ITEM_IMAGE_INCLUDE,
        ...ITEM_SET_INCLUDE,
        source: { select: citedSourceSelect },
      },
      where: { id: { in: itemIds } },
    }),
    prisma.attempt.findMany({
      orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
      select: { answer: true, id: true, isCorrect: true, itemId: true },
      where: {
        OR: [
          { itemId: { in: itemIds } },
          { id: { in: payload.checkpointAnswers.map((answer) => answer.attemptId) } },
        ],
        studySessionId: sessionId,
        userId: owned.userId,
      },
    }),
    loadDrillLessons(payload.drills.map((drill) => drill.lessonId)),
    owned.session.goal ? loadExamStructure(owned.session.goal) : null,
    owned.session.goalId && payload.chapterId && owned.block.kind === "learn"
      ? loadBlockedTestOutChapters({
          chapterIds: [payload.chapterId],
          goalId: owned.session.goalId,
          now: new Date(),
          timeZone: getAnswerTimeZone({ goal: owned.session.goal }),
          userId: owned.userId,
        })
      : new Set<string>(),
  ]);

  const items = rows.map((row) => parseSessionItem(row)).filter((item) => item !== null);
  const answers = restoreCheckpointAnswers({ answers: storedAnswers, payload });

  const timeMachines = await loadTimeMachines({
    blockId,
    items,
    payload,
    sessionId,
    userId: owned.userId,
  });

  const answered = new Map(
    answers.flatMap(({ answer, isCorrect, itemId }) =>
      itemId
        ? [[itemId, { blank: isLeftBlank({ answer, itemId, payload }), isCorrect }] as const]
        : [],
    ),
  );

  // A boss's duel decided before its last question, won or lost, is over: what's left of it is
  // never asked.
  const questionCount = payload.checkpoint
    ? getCheckpointQuestionCount({
        answeredItemIds: answered.keys(),
        askableItemIds: items.map((item) => item.id),
      })
    : items.length;

  const duelOver = isBlockDuelDecided({ answers, payload, questions: questionCount });

  // A recording's transcript shows once every one of its questions in the block is answered.
  const isSetAnswered = (setId: string | null) =>
    duelOver || rows.filter((row) => row.setId === setId).every((row) => answered.has(row.id));

  const questions = itemIds.flatMap((itemId): StudyBlockQuestion[] => {
    const item = items.find((candidate) => candidate.id === itemId);
    const row = rows.find((candidate) => candidate.id === itemId);
    const drill = payload.drills.find((candidate) => candidate.itemIds.includes(itemId));

    return item
      ? [
          {
            ...toSessionQuestion({ blockId, item }),
            answered: answered.get(itemId) ?? null,
            capsuleKey:
              payload.capsules.find((capsule) => capsule.itemIds.includes(itemId))?.key ?? null,
            citation: row ? toItemCitation(row) : null,
            drill: drill ? toDrillView({ drill, lessons: drillLessons }) : null,
            mistakeId: drill?.mistakeId ?? null,
            placement: payload.placementItemIds.includes(itemId),
            quoted: row ? isQuotedItem(row.content) : false,
            set: row ? toItemSetView({ item: row, reveal: isSetAnswered(row.setId) }) : null,
            timeMachine: timeMachines.get(itemId) ?? null,
          },
        ]
      : [];
  });

  return {
    detail: {
      ...(payload.checkpoint && {
        answeredQuestions: [...answered].map(([itemId, answer]) => ({
          isCorrect: answer.isCorrect,
          itemId,
        })),
      }),
      block: toAskableBlock({
        block: toStudyBlockView({
          answeredItemIds: new Set(answered.keys()),
          block: owned.block,
          blockedTestOutChapters,
          blocks: owned.session.blocks,
        }),
        payload,
        questions: questionCount,
      }),
      hints: owned.block.kind !== "checkpoint",
      questions,
      // Before the notice's blueprint is linked, the formats a first pass over it read.
      trueFalseLabels: getTrueFalseLabels(
        structure ?? readNoticeFormats(owned.session.goal?.details),
      ),
    },
    status: "ready",
  };
}
