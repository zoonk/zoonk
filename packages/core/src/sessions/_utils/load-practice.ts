import "server-only";
import { type Item, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { interleave } from "@zoonk/utils/interleave";
import { getSkillRetrievability } from "../../learner/fsrs-scheduler";
import { getFieldRank, getItemAudienceFilter } from "../../library/items/item-field";
import { listItemSetsForSkills } from "../../library/items/item-sets";
import { type DifficultyBias } from "../../plans/planner/plan-state";
import { type PracticeItem } from "../session-builder";
import { loadLastAnswers, loadRightAnswers } from "./load-review-capsules";
import { NO_PRACTICE_CLAIMS, type PracticeClaims } from "./practice-claims";
import { listAskedSets, takePracticeQuestions, toSetUnits } from "./practice-sets";
import { getPracticeItemFilter } from "./session-items";

/** Practice rotates through the weakest skills; this many questions is plenty for any day. */
const PRACTICE_POOL = 30;

/**
 * A question answered this recently (placement, a lesson's check, yesterday evening's practice)
 * would test what's still in short-term memory, so practice waits a day before asking it again.
 */
const RECENTLY_ANSWERED_MS = MS_PER_DAY;

type PracticeCandidate = Pick<
  Item,
  "difficulty" | "examBlueprintId" | "field" | "id" | "skillId"
> & { lastAnsweredAt: Date | null };

/** What practice takes in one turn of a skill: a question, or a set's questions together. */
type PracticeUnit = PracticeCandidate & { questions: PracticeItem[] };

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
 * A review day's order: questions never answered before the missed ones it brings back, then the
 * usual order (see `comparePractice`).
 */
function compareDayPractice({
  a,
  b,
  repeatOnlyMissed,
  ...rules
}: Parameters<typeof comparePractice>[0] & { repeatOnlyMissed: boolean }): number {
  const unseenFirst = repeatOnlyMissed
    ? Number(a.lastAnsweredAt !== null) - Number(b.lastAnsweredAt !== null)
    : 0;

  return unseenFirst || comparePractice({ a, b, ...rules });
}

/** A focused skill's questions in two turns of a round, so it gets two to every other skill's one. */
function withFocusTurns<T>({
  focusSkillIds,
  items,
  skillId,
}: {
  focusSkillIds: ReadonlySet<string>;
  items: T[];
  skillId: string;
}): T[][] {
  if (!focusSkillIds.has(skillId)) {
    return [items];
  }

  return [items.filter((_, index) => index % 2 === 0), items.filter((_, index) => index % 2 === 1)];
}

/**
 * The order practice takes a goal's skills in, one question of each in turn: a held subject's
 * (`firstSkillIds`), then the ones the learner focused on, then what they were taken to know on topics the exam asks most or the class test
 * announces, then the weakest first (lowest chance of recall), and last what they were taken to
 * know on other topics, so a short block cuts that first. Topics taken as known go least recently
 * asked first, so a day too short for all of them leaves the ones it asked for later.
 */
function orderPracticeSkills({
  claims,
  firstSkillIds,
  focusSkillIds,
  skills,
}: {
  claims: PracticeClaims;
  firstSkillIds: ReadonlySet<string>;
  focusSkillIds: ReadonlySet<string>;
  skills: readonly { recall: number; skillId: string }[];
}): string[] {
  const isFirst = (skillId: string) => Number(firstSkillIds.has(skillId));
  const isFocused = (skillId: string) => Number(focusSkillIds.has(skillId));

  // Only topics to confirm take turns by it: studied skills go weakest first.
  const getLastAsked = (skillId: string) =>
    claims.first.has(skillId) || claims.last.has(skillId)
      ? (claims.lastAsked.get(skillId) ?? 0)
      : 0;

  const getTurn = (skillId: string) => {
    if (claims.first.has(skillId)) {
      return 0;
    }

    return claims.last.has(skillId) ? 2 : 1;
  };

  return skills
    .toSorted(
      (a, b) =>
        isFirst(b.skillId) - isFirst(a.skillId) ||
        isFocused(b.skillId) - isFocused(a.skillId) ||
        getTurn(a.skillId) - getTurn(b.skillId) ||
        getLastAsked(a.skillId) - getLastAsked(b.skillId) ||
        a.recall - b.recall,
    )
    .map((row) => row.skillId);
}

/**
 * The listening skills practice has nothing to ask today: no voiced recording on them that wasn't
 * answered in the last day. Their subject's time goes to the other subjects (see `pickDayLessons`).
 */
export async function loadIdleListeningSkillIds({
  examBlueprintId,
  listeningSkillIds,
  now,
  userId,
}: {
  examBlueprintId: string | null;
  listeningSkillIds: ReadonlySet<string>;
  now: Date;
  userId: string;
}): Promise<Set<string>> {
  if (listeningSkillIds.size === 0) {
    return new Set();
  }

  const sets = await listItemSetsForSkills({
    examBlueprintId,
    skillIds: [...listeningSkillIds],
    userId,
  });

  const askable = sets.filter(
    (set) =>
      set.kind === "audio" &&
      (set.lastAnsweredAt?.getTime() ?? 0) <= now.getTime() - RECENTLY_ANSWERED_MS,
  );

  return new Set(
    [...listeningSkillIds].filter(
      (skillId) => !askable.some((set) => set.skillIds.includes(skillId)),
    ),
  );
}

/**
 * Mixed practice for a goal: questions on skills the learner has studied, one skill after another
 * in turn with the weakest first (lowest chance of recall), in the exam's own format when the goal
 * has one, never one they answered in the last day. The last questions land on stronger skills, so
 * the block ends with a win. A topic the learner was taken to know gets one question until practice
 * confirms it (see `orderPracticeSkills`). A review day asks new questions first and brings back
 * only the ones the learner missed.
 */
export async function loadPracticeItems({
  claims = NO_PRACTICE_CLAIMS,
  difficultyBias,
  everySkill = false,
  examBlueprintId,
  firstSkillIds = new Set(),
  focusSkillIds = new Set(),
  excludeItemIds,
  field,
  listeningSkillIds = new Set(),
  now,
  repeatOnlyMissed = false,
  skillIds,
  typed,
  userId,
}: {
  /**
   * The skills the learner was taken to know that practice still has to confirm (see
   * `loadPracticeClaims`), asked whether or not the plan teaches them.
   */
  claims?: PracticeClaims;
  /** The plan's "Too easy" or "Too hard" steering. */
  difficultyBias: DifficultyBias;
  /**
   * Every skill of the goal, not only the ones studied: a full review asks every topic of the
   * test, the ones never studied first, as the weakest.
   */
  everySkill?: boolean;
  /**
   * The skills of a day's subject with nothing written to study yet (`listHeldAreas`): its time
   * goes to their questions, asked first, studied or not.
   */
  firstSkillIds?: ReadonlySet<string>;
  /**
   * Skills the learner asked to focus on, on a review day: they open the practice and get two
   * questions to every other skill's one.
   */
  focusSkillIds?: ReadonlySet<string>;
  examBlueprintId: string | null;
  excludeItemIds: ReadonlySet<string>;
  /** The goal's field (work and career goals): its questions come first, other fields' never. */
  field: string | null;
  /**
   * Skills only recordings practice (`getListeningSkillIds`): a text question or a text set about
   * a conversation tests reading, so they get a voiced recording's questions or wait.
   */
  listeningSkillIds?: ReadonlySet<string>;
  now: Date;
  /**
   * A review day (the day before a test, a free plan's mock day): questions the learner answered
   * right last time don't come back, and the ones never answered come before the missed ones.
   */
  repeatOnlyMissed?: boolean;
  skillIds: readonly string[];
  /** Short typed answers join the goal's practice (`practicesShortAnswers`). */
  typed: boolean;
  userId: string;
}): Promise<PracticeItem[]> {
  const claimed = new Set([...claims.first, ...claims.last]);
  const pool = [...new Set([...skillIds, ...claimed, ...firstSkillIds])];

  const studied = await prisma.learnerSkill.findMany({
    where: { reps: { gt: 0 }, skillId: { in: pool }, userId },
  });

  const recalls = studied.map((row) => ({
    recall: getSkillRetrievability({ memory: row, now }) ?? 0,
    skillId: row.skillId,
  }));

  const unstudied = pool
    .filter(
      (skillId) =>
        (everySkill || claimed.has(skillId) || firstSkillIds.has(skillId)) &&
        !studied.some((row) => row.skillId === skillId),
    )
    .map((skillId) => ({ recall: 0, skillId }));

  const ordered = orderPracticeSkills({
    claims,
    firstSkillIds,
    focusSkillIds,
    skills: [...unstudied, ...recalls],
  });

  const [items, sets] = await Promise.all([
    prisma.item.findMany({
      orderBy: { id: "asc" },
      select: { difficulty: true, examBlueprintId: true, field: true, id: true, skillId: true },
      where: {
        ...getPracticeItemFilter({ typed }),
        skillId: { in: ordered.filter((skillId) => !listeningSkillIds.has(skillId)) },
        ...getItemAudienceFilter({ examBlueprintId, field }),
      },
    }),
    listItemSetsForSkills({ examBlueprintId, skillIds: ordered, userId }),
  ]);

  const itemIds = [...items, ...sets.flatMap((set) => set.items)].map((item) => item.id);

  const [lastAnswers, answeredRight] = await Promise.all([
    loadLastAnswers({ itemIds, userId }),
    repeatOnlyMissed ? loadRightAnswers({ itemIds, userId }) : new Set<string>(),
  ]);

  const isAsked = (itemId: string) =>
    !excludeItemIds.has(itemId) &&
    !answeredRight.has(itemId) &&
    (lastAnswers.get(itemId)?.getTime() ?? 0) <= now.getTime() - RECENTLY_ANSWERED_MS;

  const rules = { difficultyBias, examBlueprintId, field, repeatOnlyMissed };

  const askedSets = listAskedSets({ isAsked, listeningSkillIds, sets });

  // One question confirms what the learner was taken to know, or brings its lessons back, so a
  // set waits, except a listening skill's recording (see `toSetUnits`); a full review asks it like
  // every other topic.
  const perSkill = ordered.map((skillId) => {
    const isOne = claimed.has(skillId) && !everySkill;

    return [
      ...toSetUnits({ isOne, listeningSkillIds, ordered, sets: askedSets, skillId }),
      ...items
        .filter((item) => item.skillId === skillId && isAsked(item.id))
        .map((item): PracticeUnit => ({
          ...item,
          lastAnsweredAt: lastAnswers.get(item.id) ?? null,
          questions: [{ itemId: item.id, skillId: item.skillId }],
        })),
    ]
      .toSorted((a, b) => compareDayPractice({ a, b, ...rules }))
      .slice(0, isOne ? 1 : undefined);
  });

  const units = interleave(
    perSkill.flatMap((skillUnits, index) =>
      withFocusTurns({ focusSkillIds, items: skillUnits, skillId: ordered[index] ?? "" }),
    ),
  );

  return takePracticeQuestions({
    practice: units.flatMap((unit) => unit.questions),
    room: PRACTICE_POOL,
  });
}
