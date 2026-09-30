import "server-only";
import { type Item, prisma } from "@zoonk/db";
import { interleave } from "@zoonk/utils/interleave";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getSkillRetrievability } from "../../learner/fsrs-scheduler";
import { getFieldRank, getItemAudienceFilter } from "../../library/items/item-field";
import { findTeachingLessonIds } from "../../mistakes/drill-lessons";
import { selectMistakeDrill, selectMistakesToPractice } from "../../mistakes/mistake-drills";
import { type DifficultyBias } from "../../plans/planner/plan-state";
import { type BlockDrill } from "../block-payload";
import { type PracticeItem } from "../session-builder";
import { loadLastAnswers } from "./load-review-capsules";
import { QUESTION_ITEM_FORMATS, hasTraps, parseSessionItem } from "./session-items";

/** Practice rotates through the weakest skills; this many questions is plenty for any day. */
const PRACTICE_POOL = 30;

/** Open mistakes considered for today's drill, oldest first. */
const MISTAKE_POOL = 50;

/** One mistake a day makes the "fix a mistake" mission; the notebook holds the rest. */
const DAILY_MISTAKE_DRILLS = 1;

type PracticeCandidate = Pick<
  Item,
  "difficulty" | "examBlueprintId" | "field" | "id" | "skillId"
> & { lastAnsweredAt: Date | null };

/**
 * "Too easy" asks for the hardest questions first and "Too hard" for the easiest; a question
 * without a difficulty counts as medium. Standard keeps the order the rest of the rules give.
 */
function compareDifficulty({
  a,
  b,
  difficultyBias,
}: {
  a: PracticeCandidate;
  b: PracticeCandidate;
  difficultyBias: DifficultyBias;
}): number {
  if (difficultyBias === "standard") {
    return 0;
  }

  const gap = (a.difficulty ?? 0) - (b.difficulty ?? 0);
  return difficultyBias === "harder" ? -gap : gap;
}

/**
 * The exam's own questions first, then questions set in the learner's field, then the difficulty
 * the learner steered toward, then never-answered ones, then those answered longest ago.
 */
function comparePractice({
  a,
  b,
  difficultyBias,
  examBlueprintId,
  field,
}: {
  a: PracticeCandidate;
  b: PracticeCandidate;
  difficultyBias: DifficultyBias;
  examBlueprintId: string | null;
  field: string | null;
}): number {
  const examA = examBlueprintId && a.examBlueprintId === examBlueprintId ? 0 : 1;
  const examB = examBlueprintId && b.examBlueprintId === examBlueprintId ? 0 : 1;

  if (examA !== examB) {
    return examA - examB;
  }

  const fieldGap =
    getFieldRank({ field, itemField: a.field }) - getFieldRank({ field, itemField: b.field });

  if (fieldGap !== 0) {
    return fieldGap;
  }

  const difficulty = compareDifficulty({ a, b, difficultyBias });

  if (difficulty !== 0) {
    return difficulty;
  }

  return (a.lastAnsweredAt?.getTime() ?? 0) - (b.lastAnsweredAt?.getTime() ?? 0);
}

/**
 * Mixed practice for a goal: questions on skills the learner has studied, one skill after another
 * in turn with the weakest first (lowest chance of recall), in the exam's own format when the goal
 * has one. The last questions land on stronger skills, so the block ends with a win.
 */
export async function loadPracticeItems({
  difficultyBias,
  examBlueprintId,
  excludeItemIds,
  field,
  now,
  skillIds,
  userId,
}: {
  /** The plan's "Too easy" or "Too hard" steering. */
  difficultyBias: DifficultyBias;
  examBlueprintId: string | null;
  excludeItemIds: ReadonlySet<string>;
  /** The goal's field (work and career goals): its questions come first, other fields' never. */
  field: string | null;
  now: Date;
  skillIds: readonly string[];
  userId: string;
}): Promise<PracticeItem[]> {
  const studied = await prisma.learnerSkill.findMany({
    where: { reps: { gt: 0 }, skillId: { in: [...skillIds] }, userId },
  });

  const weakestFirst = studied
    .map((row) => ({
      recall: getSkillRetrievability({ memory: row, now }) ?? 0,
      skillId: row.skillId,
    }))
    .toSorted((a, b) => a.recall - b.recall)
    .map((row) => row.skillId);

  const items = await prisma.item.findMany({
    orderBy: { id: "asc" },
    select: { difficulty: true, examBlueprintId: true, field: true, id: true, skillId: true },
    where: {
      format: { in: [...QUESTION_ITEM_FORMATS] },
      skillId: { in: weakestFirst },
      ...getItemAudienceFilter({ examBlueprintId, field }),
    },
  });

  const lastAnswers = await loadLastAnswers({ itemIds: items.map((item) => item.id), userId });

  const perSkill = weakestFirst.map((skillId) =>
    items
      .filter((item) => item.skillId === skillId && !excludeItemIds.has(item.id))
      .map((item) => ({ ...item, lastAnsweredAt: lastAnswers.get(item.id) ?? null }))
      .toSorted((a, b) => comparePractice({ a, b, difficultyBias, examBlueprintId, field })),
  );

  return interleave(perSkill)
    .slice(0, PRACTICE_POOL)
    .map((item) => ({ itemId: item.id, skillId: item.skillId }));
}

/**
 * Today's "fix a mistake": the oldest open mistake on the goal's skills from an earlier day, with
 * the drill its cause calls for (the same question first, then a few more on its skill), its kind,
 * the lesson a content gap goes over first and a timed drill's time box.
 */
export async function loadMistakeDrills({
  examBlueprintId,
  field,
  skillIds,
  timeZone,
  today,
  userId,
}: {
  /** The goal's exam: other exams' questions never come up in a drill. */
  examBlueprintId: string | null;
  /** The goal's field: its questions come first in a drill, other fields' never. */
  field: string | null;
  skillIds: readonly string[];
  timeZone: string;
  /** The learner-local date, as a UTC-midnight label. */
  today: Date;
  userId: string;
}): Promise<BlockDrill[]> {
  const open = await prisma.mistake.findMany({
    orderBy: { createdAt: "asc" },
    take: MISTAKE_POOL,
    where: { skillId: { in: [...skillIds] }, status: "open", userId },
  });

  const selected = selectMistakesToPractice({
    limit: DAILY_MISTAKE_DRILLS,
    mistakes: open.map((mistake) => ({
      ...mistake,
      createdLocalDate: getDateInTimeZone({ date: mistake.createdAt, timeZone }),
    })),
    today,
  });

  const selectedSkillIds = selected.flatMap((mistake) =>
    mistake.skillId ? [mistake.skillId] : [],
  );

  const [items, lessons] = await Promise.all([
    prisma.item.findMany({
      orderBy: { id: "asc" },
      where: {
        format: { in: [...QUESTION_ITEM_FORMATS] },
        skillId: { in: selectedSkillIds },
        ...getItemAudienceFilter({
          examBlueprintId,
          field,
          keepIds: selected.flatMap((mistake) => mistake.itemId ?? []),
        }),
      },
    }),
    findTeachingLessonIds({ skillIds: selectedSkillIds, userId }),
  ]);

  const lastAnswers = await loadLastAnswers({ itemIds: items.map((item) => item.id), userId });

  const questions = items
    .toSorted(
      (a, b) =>
        getFieldRank({ field, itemField: a.field }) - getFieldRank({ field, itemField: b.field }),
    )
    .map((item) => parseSessionItem(item))
    .filter((item) => item !== null);

  return selected
    .map((mistake) => {
      const drill = selectMistakeDrill({
        candidates: questions
          .filter((item) => item.skillId === mistake.skillId)
          .map((item) => ({
            hasMisconceptions: hasTraps(item),
            id: item.id,
            seen: lastAnswers.has(item.id),
          })),
        cause: mistake.cause,
        lessonId: mistake.skillId ? (lessons.get(mistake.skillId) ?? null) : null,
        originalItemId: mistake.itemId,
      });

      return { ...drill, mistakeId: mistake.id };
    })
    .filter((drill) => drill.itemIds.length > 0);
}
