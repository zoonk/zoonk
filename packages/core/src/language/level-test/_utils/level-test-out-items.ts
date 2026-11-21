import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import {
  LOW_GUESS_ANSWERS_TO_SKIP,
  isLowGuessTap,
  isQuickChoice,
} from "../../../learner/_utils/placement-guess-rate";
import { libraryRowsVisibleTo } from "../../../library/_utils/library-visibility";
import { getItemAudienceFilter, getPublicMaterialFilters } from "../../../library/items/item-field";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { ITEM_SET_INCLUDE, toItemSetView } from "../../../library/items/item-sets";
import { loadUndoneTestOuts } from "../../../plans/_utils/undone-test-outs";
import { parseSessionItem, toSessionQuestion } from "../../../sessions/_utils/session-items";
import { type LevelTestOutLevel, type LevelTestOutProgress } from "../level-test-out-contract";

const ITEM_INCLUDE = { ...ITEM_IMAGE_INCLUDE, ...ITEM_SET_INCLUDE };

function isListeningReady(row: Awaited<ReturnType<typeof loadTestOutItem>>) {
  return (
    row?.set?.kind === "audio" &&
    Boolean(toItemSetView({ item: row, reveal: false })?.listening?.audio)
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
  const confirms = usable.filter((row) => isLowGuessTap(row)).slice(0, LOW_GUESS_ANSWERS_TO_SKIP);

  return probe && confirms.length === LOW_GUESS_ANSWERS_TO_SKIP
    ? [probe.id, ...confirms.map(({ id }) => id)]
    : [];
}

export async function listTestOutSkillIds({
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
}) {
  const lessons = await tx.planItem.findMany({
    orderBy: { position: "asc" },
    select: {
      lesson: {
        select: { skills: { select: { skillId: true }, where: { skill: { cefrLevel: level } } } },
      },
    },
    where: { kind: "lesson", plan: { goalId }, status: "todo" },
  });

  const skillIds = [
    ...new Set(lessons.flatMap(({ lesson }) => lesson?.skills.map(({ skillId }) => skillId) ?? [])),
  ];

  const today = getDateInTimeZone({ date: new Date(), timeZone });
  const undone = await loadUndoneTestOuts(goalId, { timeZone, tx });

  const misses = await tx.attempt.findMany({
    distinct: ["skillId"],
    select: { skillId: true },
    where: {
      isCorrect: false,
      itemId: { not: null },
      localDate: { gte: today },
      skillId: { in: skillIds },
      stepId: null,
      userId,
    },
  });

  const blocked = new Set([
    ...misses.map(({ skillId }) => skillId),
    ...undone
      .filter(({ at }) => getDateInTimeZone({ date: at, timeZone }) >= today)
      .map(({ skillId }) => skillId),
  ]);

  return skillIds.filter((id) => !blocked.has(id));
}

export async function readTestOutBank({
  skillIds,
  tx,
  userId,
}: {
  skillIds: string[];
  tx: TransactionClient;
  userId: string;
}) {
  const bank = await tx.item.findMany({
    include: ITEM_INCLUDE,
    orderBy: { id: "asc" },
    where: {
      AND: [
        ...getItemAudienceFilter({ inSets: true }).AND,
        ...getPublicMaterialFilters(),
        { OR: [{ setId: null }, { set: { AND: getPublicMaterialFilters() } }] },
        { OR: [{ sourceId: null }, { source: { is: libraryRowsVisibleTo(userId) } }] },
      ],
      attempts: { none: { userId } },
      format: { in: ["multipleChoice", "matchPairs", "order"] },
      retiredAt: null,
      skill: { ...libraryRowsVisibleTo(userId) },
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

  const unvoicedSetId =
    [
      ...Map.groupBy(
        bank.filter((row) => row.set?.kind === "audio" && row.set.mediaAssetId === null),
        (row) => `${row.set?.id}:${row.skillId}`,
      ),
    ].find(([, rows]) => pickTopicQuestions(rows).length > 0)?.[1][0]?.set?.id ?? null;

  const questions = [
    ...(reading?.ids.map((id) => ({ id, skill: "reading" as const, skillId: reading.skillId })) ??
      []),
    ...(listening?.ids.map((id) => ({
      id,
      skill: "listening" as const,
      skillId: listening.skillId,
    })) ?? []),
  ];

  return {
    listening: Boolean(listening),
    questions: reading && listening ? questions : [],
    unvoicedSetId,
  };
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
