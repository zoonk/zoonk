import "server-only";
import { prisma } from "@zoonk/db";
import { readNoticeFormats } from "../library/exams/notice-formats";
import { type TrueFalseLabels, getTrueFalseLabels } from "../library/exams/true-false-labels";
import { isQuotedItem } from "../library/items/item-content";
import { ITEM_IMAGE_INCLUDE } from "../library/items/item-image";
import {
  type ItemCitation,
  citedSourceSelect,
  toItemCitation,
} from "../library/sources/source-citation";
import { type DrillView, loadDrillLessons, toDrillView } from "../mistakes/drill-lessons";
import { loadExamStructure } from "./_utils/load-build-inputs";
import { isLeftBlank } from "./_utils/net-score";
import {
  type SessionItem,
  type SessionQuestion,
  describeEarlierAnswer,
  parseSessionItem,
  toSessionQuestion,
} from "./_utils/session-items";
import { type StudyBlockView, toStudyBlockView } from "./_utils/session-view";
import { findOwnedStudyBlock } from "./_utils/study-session-access";
import { type BlockPayload, getBlockItemIds, readBlockPayload } from "./block-payload";

/**
 * The learner's last answer to a capsule question before this session: when, whether it was right
 * and, only when it was wrong, the answer as text ("On Sep 30 you answered $18"). A right one is
 * never sent, since it would give today's answer away. Match answers have no single text, and a
 * math answer given with other numbers says nothing about today's, so those only say whether it
 * was right.
 */
type TimeMachine = { answer: string | null; answeredAt: Date; isCorrect: boolean };

type StudyBlockQuestion = SessionQuestion & {
  /**
   * Set once answered in this session: a checkpoint shows right or wrong without hints, and a
   * net-scored statement left blank counts as neither.
   */
  answered: { blank: boolean; isCorrect: boolean } | null;
  capsuleKey: string | null;
  /**
   * The passage the question quotes, such as an article of law, with its source's title, link and
   * the date it was last checked, for the dated "Sources" chip.
   */
  citation: ItemCitation | null;
  /** How a saved mistake's drill plays this question, by the mistake's cause. */
  drill: DrillView | null;
  mistakeId: string | null;
  /**
   * A placement question in the goal's first week: it fine-tunes where the plan starts, isn't
   * graded as learning, and welcomes "I don't know yet".
   */
  placement: boolean;
  /**
   * A real past exam question copied as printed, where its organizer allows it with the source
   * cited: it shows where it's from before it's answered.
   */
  quoted: boolean;
  timeMachine: TimeMachine | null;
};

type StudyBlockDetail = {
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

  const [rows, answers, drillLessons, structure] = await Promise.all([
    prisma.item.findMany({
      include: { ...ITEM_IMAGE_INCLUDE, source: { select: citedSourceSelect } },
      where: { id: { in: itemIds } },
    }),
    prisma.attempt.findMany({
      orderBy: { answeredAt: "asc" },
      select: { answer: true, isCorrect: true, itemId: true },
      where: { itemId: { in: itemIds }, studySessionId: sessionId, userId: owned.userId },
    }),
    loadDrillLessons(payload.drills.map((drill) => drill.lessonId)),
    owned.session.goal ? loadExamStructure(owned.session.goal) : null,
  ]);

  const items = rows.map((row) => parseSessionItem(row)).filter((item) => item !== null);

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
            timeMachine: timeMachines.get(itemId) ?? null,
          },
        ]
      : [];
  });

  return {
    detail: {
      block: toStudyBlockView({ answeredItemIds: new Set(answered.keys()), block: owned.block }),
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
