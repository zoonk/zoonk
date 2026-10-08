import "server-only";
import { type Item, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";

/** Fewer first answers than this say more about who answered than about the question. */
const MIN_LEARNERS = 20;

/**
 * The logistic constant of the IRT model exams score with (`exams/scoring/irt`), so a
 * recalibrated difficulty reads on the same scale as the generator's easy (-1), medium (0) and
 * hard (1).
 */
const IRT_SCALING = 1.7;
const MAX_DIFFICULTY = 3;
/** Keeps an item everyone (or no one) got right finite on the logistic scale. */
const MIN_SHARE = 0.02;
/** Smaller moves are noise; skipping them keeps the daily sweep's writes to what changed. */
const MIN_CHANGE = 0.01;
const DIFFICULTY_DECIMALS = 100;
/** Options a multiple-choice item offers when its content doesn't say. */
const DEFAULT_OPTIONS = 4;

type AnswerCounts = { answers: number; correct: number; itemId: string };

/** The chance of a right answer by luck, which a right answer's share includes. */
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

/**
 * The difficulty at which a learner of average ability (0) answers right as often as learners
 * did, after taking lucky guesses out: the same three-parameter curve exams score with, with the
 * default discrimination. A +1/+2 smoothing keeps a handful of answers from reaching the extremes.
 */
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

/** The item's new difficulty, or nothing when it didn't move enough to be worth a write. */
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

/**
 * Each learner's first answer per item, for items answered in the day before `now`: later answers come
 * after the lesson and reviews, so they would make every item look easier than it is. Essays are
 * scored on a rubric, not right or wrong, so they keep their generated difficulty.
 */
async function countFirstAnswers(now: Date) {
  const since = new Date(now.getTime() - MS_PER_DAY);

  return prisma.$queryRaw<AnswerCounts[]>`
    WITH recent AS (
      SELECT DISTINCT a.item_id FROM attempts a
      JOIN items i ON i.id = a.item_id
      WHERE a.answered_at >= ${since} AND a.answered_at < ${now} AND i.format <> 'essay'
    ),
    first_answers AS (
      SELECT DISTINCT ON (a.item_id, a.user_id) a.item_id, a.is_correct
      FROM attempts a
      JOIN recent r ON r.item_id = a.item_id
      ORDER BY a.item_id, a.user_id, a.answered_at
    )
    SELECT item_id AS "itemId", count(*)::int AS answers,
      count(*) FILTER (WHERE is_correct)::int AS correct
    FROM first_answers
    GROUP BY item_id
    HAVING count(*) >= ${MIN_LEARNERS}`;
}

/**
 * Real answers recalibrate the difficulty the generator gave each question: every day, items
 * answered since the last run get the difficulty their learners' first answers show, once enough
 * learners answered them. One query covers every item, so the daily sweep runs it. Returns how
 * many items moved.
 */
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
