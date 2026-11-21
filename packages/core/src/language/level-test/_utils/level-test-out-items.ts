import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isLowGuessTap, isQuickChoice } from "../../../learner/_utils/placement-guess-rate";
import { libraryRowsVisibleTo } from "../../../library/_utils/library-visibility";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { ITEM_SET_INCLUDE, toItemSetView } from "../../../library/items/item-sets";
import { loadUndoneTestOuts } from "../../../plans/_utils/undone-test-outs";
import { parseSessionItem, toSessionQuestion } from "../../../sessions/_utils/session-items";
import { type LevelTestOutLevel, type LevelTestOutProgress } from "../level-test-out-contract";

const CONFIRMATION_ITEMS = 3;
const ITEM_INCLUDE = { ...ITEM_IMAGE_INCLUDE, ...ITEM_SET_INCLUDE };

function isListeningReady(row: Awaited<ReturnType<typeof loadTestOutItem>>) {
  return (
    row?.set?.kind === "audio" && Boolean(toItemSetView({ item: row, reveal: false })?.listening)
  );
}

export function loadTestOutItem({ id, tx }: { id: string; tx: TransactionClient }) {
  return tx.item.findUnique({ include: ITEM_INCLUDE, where: { id } });
}

function pickTopicQuestions(
  rows: NonNullable<Awaited<ReturnType<typeof loadTestOutItem>>>[],
): string[] {
  const usable = rows.filter((row) => parseSessionItem(row) !== null);
  const probe = usable.find((row) => isQuickChoice(row));
  const confirms = usable.filter((row) => isLowGuessTap(row)).slice(0, CONFIRMATION_ITEMS);

  return probe && confirms.length === CONFIRMATION_ITEMS
    ? [probe.id, ...confirms.map(({ id }) => id)]
    : [];
}

export async function pickTestOutQuestions({
  goalId,
  level,
  timeZone,
  tx,
  userId,
}: {
  goalId: string;
  level: LevelTestOutLevel;
  timeZone: string;
  tx: TransactionClient;
  userId: string;
}): Promise<LevelTestOutProgress["questions"]> {
  const lessons = await tx.planItem.findMany({
    orderBy: { position: "asc" },
    select: {
      lesson: {
        select: { skills: { select: { skillId: true }, where: { skill: { cefrLevel: level } } } },
      },
    },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  const today = getDateInTimeZone({ date: new Date(), timeZone });
  const undone = await loadUndoneTestOuts(goalId);

  const blocked = new Set(
    undone
      .filter(({ at }) => getDateInTimeZone({ date: at, timeZone }) >= today)
      .map(({ skillId }) => skillId),
  );

  const skillIds = [
    ...new Set(lessons.flatMap(({ lesson }) => lesson?.skills.map(({ skillId }) => skillId) ?? [])),
  ].filter((id) => !blocked.has(id));

  const bank = await tx.item.findMany({
    include: ITEM_INCLUDE,
    orderBy: { id: "asc" },
    where: {
      ...getItemAudienceFilter({ inSets: true }),
      attempts: { none: { userId } },
      format: { in: ["multipleChoice", "matchPairs", "order"] },
      skill: {
        ...libraryRowsVisibleTo(userId),
        attempts: {
          none: {
            isCorrect: false,
            itemId: { not: null },
            localDate: { gte: today },
            stepId: null,
            userId,
          },
        },
      },
      skillId: { in: skillIds },
    },
  });

  const bySkill = Map.groupBy(bank, ({ skillId }) => skillId);

  const pick = (skill: "reading" | "listening") =>
    skillIds
      .map((skillId) => ({
        ids: pickTopicQuestions(
          (bySkill.get(skillId) ?? []).filter((row) =>
            skill === "listening" ? isListeningReady(row) : row.set?.kind !== "audio",
          ),
        ),
        skillId,
      }))
      .find(({ ids }) => ids.length > 0);

  const reading = pick("reading");
  const listening = pick("listening");

  if (!reading || !listening) {
    return [];
  }

  return [
    ...reading.ids.map((id) => ({ id, skill: "reading" as const, skillId: reading.skillId })),
    ...listening.ids.map((id) => ({ id, skill: "listening" as const, skillId: listening.skillId })),
  ];
}

export function toTestOutQuestion({
  attemptId,
  row,
  skill,
}: {
  attemptId: string;
  row: NonNullable<Awaited<ReturnType<typeof loadTestOutItem>>>;
  skill: LevelTestOutProgress["questions"][number]["skill"];
}) {
  const item = parseSessionItem(row);

  return item
    ? {
        ...toSessionQuestion({ blockId: attemptId, item }),
        set: toItemSetView({ item: row, reveal: false }),
        skill,
      }
    : null;
}
