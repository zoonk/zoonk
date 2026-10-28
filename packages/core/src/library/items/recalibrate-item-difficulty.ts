import "server-only";
import { type Item, prisma, sql } from "@zoonk/db";
import { firstAnswersSql } from "@zoonk/db/anonymous-records";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";

const MIN_LEARNERS = 20;

const IRT_SCALING = 1.7;
const MAX_DIFFICULTY = 3;
/** Keeps an item everyone (or no one) got right finite on the logistic scale. */
const MIN_SHARE = 0.02;
const MIN_CHANGE = 0.01;
const DIFFICULTY_DECIMALS = 100;
const DEFAULT_OPTIONS = 4;

type AnswerCounts = { answers: number; correct: number; itemId: string };

function getGuessRate(item: Pick<Item, "content" | "format">): number {
  if (item.format === "trueFalse") {
    return 1 / 2;
  }

  if (item.format !== "multipleChoice") {
    return 0;
  }

  const options = isJsonObject(item.content) ? item.content.options : null;
  return 1 / (Array.isArray(options) && options.length > 1 ? options.length : DEFAULT_OPTIONS);
}

function clamp({ max, min, value }: { max: number; min: number; value: number }): number {
  return Math.min(max, Math.max(min, value));
}

function estimateDifficulty({
  counts,
  guessRate,
}: {
  counts: AnswerCounts;
  guessRate: number;
}): number {
  const share = (counts.correct + 1) / (counts.answers + 2);

  const known = clamp({
    max: 1 - MIN_SHARE,
    min: MIN_SHARE,
    value: (share - guessRate) / (1 - guessRate),
  });

  const difficulty = Math.log((1 - known) / known) / IRT_SCALING;
  const bounded = clamp({ max: MAX_DIFFICULTY, min: -MAX_DIFFICULTY, value: difficulty });

  return Math.round(bounded * DIFFICULTY_DECIMALS) / DIFFICULTY_DECIMALS;
}

function toRecalibration({
  counts,
  item,
}: {
  counts: AnswerCounts;
  item: Item | undefined;
}): { difficulty: number; id: string }[] {
  if (!item) {
    return [];
  }

  const difficulty = estimateDifficulty({ counts, guessRate: getGuessRate(item) });
  const moved = item.difficulty === null || Math.abs(item.difficulty - difficulty) >= MIN_CHANGE;

  return moved ? [{ difficulty, id: item.id }] : [];
}

async function countFirstAnswers(now: Date) {
  const since = new Date(now.getTime() - MS_PER_DAY);

  return prisma.$queryRaw<AnswerCounts[]>`
    WITH recent AS (
      SELECT DISTINCT a.item_id FROM attempts a
      JOIN items i ON i.id = a.item_id
      WHERE a.answered_at >= ${since} AND a.answered_at < ${now} AND i.format <> 'essay'
    )
    SELECT item_id AS "itemId", count(*)::int AS answers,
      count(*) FILTER (WHERE is_correct)::int AS correct
    FROM ${firstAnswersSql(sql`SELECT item_id FROM recent`)} first_answers
    GROUP BY item_id
    HAVING count(*) >= ${MIN_LEARNERS}`;
}

export async function recalibrateItemDifficulties({
  now = new Date(),
}: { now?: Date } = {}): Promise<{ recalibrated: number }> {
  const counts = await countFirstAnswers(now);

  if (counts.length === 0) {
    return { recalibrated: 0 };
  }

  const items = await prisma.item.findMany({
    where: { id: { in: counts.map((entry) => entry.itemId) } },
  });

  const byId = new Map(items.map((item) => [item.id, item]));

  const changed = counts.flatMap((entry) =>
    toRecalibration({ counts: entry, item: byId.get(entry.itemId) }),
  );

  if (changed.length === 0) {
    return { recalibrated: 0 };
  }

  await prisma.$executeRaw`
    UPDATE items AS i SET difficulty = v.difficulty, updated_at = now()
    FROM unnest(
      ${changed.map((entry) => entry.id)}::uuid[],
      ${changed.map((entry) => entry.difficulty)}::float8[]
    ) AS v(id, difficulty)
    WHERE i.id = v.id`;

  return { recalibrated: changed.length };
}
