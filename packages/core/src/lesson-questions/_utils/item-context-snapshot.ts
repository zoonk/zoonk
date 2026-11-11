import "server-only";
import { type ItemScopeContext } from "@zoonk/ai/tasks/lessons/question-context";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { ITEM_SET_INCLUDE, toItemSetView } from "../../library/items/item-sets";
import { gradeMistakeItem, toMistakeQuestion } from "../../mistakes/mistake-item";
import { type MistakeReplay, loadMistakeReplay } from "../../mistakes/mistake-replay";
import {
  type SessionItem,
  type SessionQuestion,
  gradeSessionAnswer,
  parseSessionItem,
  readRecordedAnswer,
  toSessionQuestion,
} from "../../sessions/_utils/session-items";
import { getBlockItemIds, readBlockPayload } from "../../sessions/block-payload";
import { type LessonQuestionItemContext } from "../contract";

async function findQuestionBlock({
  blockId,
  itemId,
  userId,
}: {
  blockId: string;
  itemId: string;
  userId: string;
}) {
  const block = await prisma.studySessionBlock.findFirst({
    where: { id: blockId, session: { userId } },
  });

  if (!block) {
    return null;
  }

  const payload = readBlockPayload(block);
  return !payload.checkpoint?.mock && getBlockItemIds(payload).includes(itemId) ? block : null;
}

function describeQuestion(question: SessionQuestion): ItemScopeContext["question"] {
  const options = [
    ...(question.options ?? []),
    ...(question.left ?? []),
    ...(question.right ?? []),
  ];

  const text = question.context ? `${question.context}\n\n${question.question}` : question.question;

  return { format: question.format, options, text };
}

async function describeLatestAnswer({
  blockId,
  item,
  mistakeId,
  replay,
  sessionId,
  userId,
}: {
  blockId: string;
  item: SessionItem;
  mistakeId?: string;
  replay?: Extract<MistakeReplay, { kind: "item" }>;
  sessionId: string | null;
  userId: string;
}): Promise<ItemScopeContext["answer"]> {
  const attempt = await prisma.attempt.findFirst({
    orderBy: { answeredAt: "desc" },
    where: {
      userId,
      ...(mistakeId
        ? { answer: { equals: mistakeId, path: ["practiceMistakeId"] } }
        : { itemId: item.id }),
      ...(sessionId ? { studySessionId: sessionId } : {}),
    },
  });

  const answer = attempt ? readRecordedAnswer(attempt.answer) : null;

  if (!attempt || !answer) {
    return null;
  }

  const { snapshot } = replay
    ? gradeMistakeItem({ answer, replay })
    : gradeSessionAnswer({ answer, blockId, item });

  return {
    correctAnswer: snapshot.correctAnswer ?? null,
    explanation: snapshot.explanation ?? null,
    isCorrect: attempt.isCorrect,
    learnerAnswer: snapshot.answer,
  };
}

async function buildMistakeItemContext({
  context,
  itemId,
  userId,
}: {
  context: LessonQuestionItemContext;
  itemId: string;
  userId: string;
}): Promise<ItemScopeContext | null> {
  const mistake = await prisma.mistake.findFirst({
    include: { skill: { select: { name: true } } },
    where: { id: context.mistakeId, userId },
  });

  const replay = mistake ? await loadMistakeReplay({ mistake, userId }) : null;

  if (!mistake || replay?.kind !== "item" || replay.item.id !== itemId || context.blockId) {
    return null;
  }

  const { item } = replay;
  const question = toMistakeQuestion(replay);

  const answer = context.answered
    ? await describeLatestAnswer({
        blockId: "",
        item,
        mistakeId: mistake.id,
        replay,
        sessionId: null,
        userId,
      })
    : null;

  return {
    answer,
    language: item.language,
    question: describeQuestion(question),
    scope: { kind: "item" },
    set: question.set?.text ?? null,
    skill: mistake.skill?.name ?? "",
    version: 1,
  };
}

/** Before checking, never includes answers or solutions; null for inaccessible content, unrelated blocks, or unsupported formats. */
export async function buildItemContextSnapshot({
  context,
  itemId,
  userId,
}: {
  context: LessonQuestionItemContext;
  itemId: string;
  userId: string;
}): Promise<ItemScopeContext | null> {
  if (context.mistakeId) {
    return buildMistakeItemContext({ context, itemId, userId });
  }

  const [row, block] = await Promise.all([
    prisma.item.findFirst({
      include: { ...ITEM_SET_INCLUDE, skill: { select: { name: true } } },
      where: {
        id: itemId,
        skill: libraryRowsVisibleTo(userId),
        ...(context.blockId
          ? {}
          : {
              OR: [
                { attempts: { some: { userId } } },
                { skill: { mistakes: { some: { userId } } } },
              ],
            }),
      },
    }),
    context.blockId ? findQuestionBlock({ blockId: context.blockId, itemId, userId }) : null,
  ]);

  const item = row ? parseSessionItem(row) : null;

  if (!row || !item || (context.blockId && !block)) {
    return null;
  }

  const blockId = block?.id ?? "";

  const answer = context.answered
    ? await describeLatestAnswer({ blockId, item, sessionId: block?.sessionId ?? null, userId })
    : null;

  return {
    answer,
    language: row.language,
    question: describeQuestion(toSessionQuestion({ blockId, item })),
    scope: { kind: "item" },
    set: toItemSetView({ item: row })?.text ?? null,
    skill: row.skill.name,
    version: 1,
  };
}
