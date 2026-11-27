import "server-only";
import { prisma } from "@zoonk/db";
import { NOT_LESSON_ANSWER_FILTER } from "@zoonk/db/lesson-answer";
import { io } from "next/cache";
import {
  getCheckpointQuestionCount,
  restoreCheckpointAnswers,
} from "../checkpoints/_utils/checkpoint-answer-evidence";
import { getAskablePassMark, isBlockDuelDecided } from "../checkpoints/_utils/checkpoint-outcome";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { readSavedPlan } from "../learner/facts/saved-plan";
import { loadBlockedTestOutChapters } from "../learner/test-out/_utils/offer-eligibility";
import { readNoticeFormats } from "../library/exams/notice-formats";
import { type TrueFalseLabels, getTrueFalseLabels } from "../library/exams/true-false-labels";
import { isQuotedItem } from "../library/items/item-content";
import { ITEM_IMAGE_INCLUDE, isStillAsked } from "../library/items/item-image";
import { ITEM_SET_INCLUDE, toItemSetView } from "../library/items/item-sets";
import { citedSourceSelect, toItemCitation } from "../library/sources/source-citation";
import { loadDrillLessons, toDrillView } from "../mistakes/drill-lessons";
import { loadExamStructure } from "./_utils/exam-structure";
import { isLeftBlank } from "./_utils/net-score";
import { loadPreparingMockPositions } from "./_utils/preparing-mock-blocks";
import { parseSessionItem, toSessionQuestion } from "./_utils/session-items";
import { type StudyBlockView, toStudyBlockView } from "./_utils/session-view";
import { type OwnedStudyBlock, findOwnedStudyBlock } from "./_utils/study-session-access";
import { withoutReviewedSkills } from "./_utils/without-reviewed-skills";
import { getBlueprintWritingTasks } from "./_utils/writing-block-tasks";
import { type BlockPayload, getBlockItemIds, readBlockPayload } from "./block-payload";
import { type StudyBlockQuestion } from "./study-block-question";

type StudyBlockDetail = {
  /** Includes verdicts whose question content was removed. */
  answeredQuestions?: { isCorrect: boolean; itemId: string }[];
  block: StudyBlockView;
  /** Checkpoints withhold hints, explanations, and the tutor until completion. */
  hints: boolean;
  questions: StudyBlockQuestion[];
  trueFalseLabels: TrueFalseLabels;
};

export type StudyBlockResult =
  | { detail: StudyBlockDetail; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Started checkpoints shrink to remaining askable questions; unopened ones retain their planned size. */
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

/** Requires ownership; returns questions and prior-answer identities without revealing correct answers. */
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

  return { detail: await loadStudyBlock(owned), status: "ready" };
}

/** Caller must supply the authorized block snapshot. */
export async function loadStudyBlock(
  owned: Extract<OwnedStudyBlock, { status: "ready" }>,
): Promise<StudyBlockDetail> {
  const blockId = owned.block.id;
  const sessionId = owned.session.id;
  const storedPayload = readBlockPayload(owned.block);
  const storedItemIds = getBlockItemIds(storedPayload);
  const blueprintId = owned.session.goal?.examBlueprintId;

  await io();
  const now = new Date();

  const blueprintRead =
    storedPayload.writing && blueprintId
      ? Promise.resolve(prisma.examBlueprint.findUnique({ where: { id: blueprintId } }))
      : undefined;

  const [
    rows,
    storedAnswers,
    drillLessons,
    structure,
    blueprint,
    blockedTestOutChapters,
    preparing,
  ] = await Promise.all([
    prisma.item.findMany({
      include: {
        ...ITEM_IMAGE_INCLUDE,
        ...ITEM_SET_INCLUDE,
        source: { select: citedSourceSelect },
      },
      where: { id: { in: storedItemIds } },
    }),
    prisma.attempt.findMany({
      orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
      select: { answer: true, id: true, isCorrect: true, itemId: true },
      where: {
        AND: NOT_LESSON_ANSWER_FILTER,
        OR: [
          { itemId: { in: storedItemIds } },
          { id: { in: storedPayload.checkpointAnswers.map((answer) => answer.attemptId) } },
        ],
        studySessionId: sessionId,
        userId: owned.userId,
      },
    }),
    loadDrillLessons(storedPayload.drills.map((drill) => drill.lessonId)),
    owned.session.goal ? loadExamStructure(owned.session.goal, { blueprint: blueprintRead }) : null,
    blueprintRead,
    owned.session.goalId && storedPayload.chapterId && owned.block.kind === "learn"
      ? loadBlockedTestOutChapters({
          chapterIds: [storedPayload.chapterId],
          goalId: owned.session.goalId,
          known: {
            goal: owned.session.goal,
            source: readSavedPlan(owned.userId, owned.session.goalId),
          },
          now,
          timeZone: getAnswerTimeZone({ goal: owned.session.goal }),
          userId: owned.userId,
        })
      : new Set<string>(),
    loadPreparingMockPositions({ ...owned.session, blocks: [owned.block] }),
  ]);

  const block = await withoutReviewedSkills({
    answeredItemIds: new Set(storedAnswers.map((answer) => answer.itemId)),
    block: owned.block,
    items: rows,
    now,
    session: owned.session,
    timeZone: getAnswerTimeZone({ goal: owned.session.goal }),
  });

  const payload = readBlockPayload(block);
  const itemIds = getBlockItemIds(payload);

  const answers = restoreCheckpointAnswers({ answers: storedAnswers, payload });

  const answered = new Map(
    answers.flatMap(({ answer, isCorrect, itemId }) =>
      itemId
        ? [[itemId, { blank: isLeftBlank({ answer, itemId, payload }), isCorrect }] as const]
        : [],
    ),
  );

  const items = rows
    .filter((row) => itemIds.includes(row.id))
    .map((row) => parseSessionItem(row))
    .filter((item) => item !== null)
    .filter((item) => isStillAsked({ answered: answered.has(item.id), item }));

  // A decided duel ends even when some questions remain unasked.
  const questionCount = payload.checkpoint
    ? getCheckpointQuestionCount({
        answeredItemIds: answered.keys(),
        askableItemIds: items.map((item) => item.id),
      })
    : items.length;

  const duelOver = isBlockDuelDecided({ answers, payload, questions: questionCount });

  // Showing a recording's transcript before its questions end would reveal answers.
  const isSetAnswered = (setId: string | null) =>
    duelOver || rows.filter((row) => row.setId === setId).every((row) => answered.has(row.id));

  const questions = itemIds.flatMap((itemId): StudyBlockQuestion[] => {
    const item = items.find((candidate) => candidate.id === itemId);
    const row = rows.find((candidate) => candidate.id === itemId);
    const drill = payload.drills.find((candidate) => candidate.itemIds.includes(itemId));
    const capsule = payload.capsules.find((candidate) => candidate.itemIds.includes(itemId));
    const placement = payload.placementItemIds.includes(itemId);

    return item
      ? [
          {
            ...toSessionQuestion({
              blockId,
              item,
              keepsStoredOrder: !payload.shufflesOptions,
              revealMatchKey: owned.block.kind === "review" && Boolean(capsule) && !placement,
            }),
            answered: answered.get(itemId) ?? null,
            capsuleKey: capsule?.key ?? null,
            citation: row ? toItemCitation(row) : null,
            drill: drill ? toDrillView({ drill, lessons: drillLessons }) : null,
            mistakeId: drill?.mistakeId ?? null,
            placement,
            quoted: row ? isQuotedItem(row.content) : false,
            set: row ? toItemSetView({ item: row, reveal: isSetAnswered(row.setId) }) : null,
          },
        ]
      : [];
  });

  return {
    ...(payload.checkpoint && {
      answeredQuestions: [...answered].map(([itemId, answer]) => ({
        isCorrect: answer.isCorrect,
        itemId,
      })),
    }),
    block: toAskableBlock({
      block: toStudyBlockView({
        answeredAttemptIds: new Set(storedAnswers.map((answer) => answer.id)),
        answeredItemIds: new Set(answered.keys()),
        block,
        blockedTestOutChapters,
        blocks: owned.session.blocks,
        preparing: preparing.has(block.position),
        writingTasks: getBlueprintWritingTasks(blueprint),
      }),
      payload,
      questions: questionCount,
    }),
    hints: owned.block.kind !== "checkpoint",
    questions,
    // Before blueprint linking, the notice's first-pass formats remain authoritative.
    trueFalseLabels: getTrueFalseLabels(
      structure ?? readNoticeFormats(owned.session.goal?.details),
    ),
  };
}
