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

const PRACTICE_POOL = 30;

/** Recent answers test short-term recognition, so wait a full day before repeating them in practice. */
const RECENTLY_ANSWERED_MS = MS_PER_DAY;

type PracticeCandidate = Pick<
  Item,
  "difficulty" | "examBlueprintId" | "field" | "id" | "skillId"
> & { lastAnsweredAt: Date | null };

type PracticeUnit = PracticeCandidate & { questions: PracticeItem[] };

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

  // Rotate claims awaiting confirmation; studied skills must remain ordered by recall risk.
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

/** Listening-only skills without a voiced recording not heard in the last day release their reserved subject time. */
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

/** Never repeats an answer from the last day; review days prioritize unseen questions and repeat only misses. */
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
  /** Include unconfirmed claims even when their lessons are absent from the plan. */
  claims?: PracticeClaims;
  difficultyBias: DifficultyBias;
  /** Include every goal topic, even unstudied ones, in full reviews. */
  everySkill?: boolean;
  /** Reserve priority practice for subjects whose written lessons are not ready. */
  firstSkillIds?: ReadonlySet<string>;
  /** Focused topics get two questions per other topic's one on review days. */
  focusSkillIds?: ReadonlySet<string>;
  examBlueprintId: string | null;
  excludeItemIds: ReadonlySet<string>;
  /** The goal's field (work and career goals): its questions come first, other fields' never. */
  field: string | null;
  /** Text passages cannot substitute for listening; use voiced recordings or wait. */
  listeningSkillIds?: ReadonlySet<string>;
  now: Date;
  /** Prefer unseen questions and repeat only previously missed ones. */
  repeatOnlyMissed?: boolean;
  skillIds: readonly string[];
  typed: boolean;
  userId: string;
}): Promise<PracticeItem[]> {
  const claimed = new Set([...claims.first, ...claims.last]);
  const pool = [...new Set([...skillIds, ...claimed, ...firstSkillIds])];

  const studied = await prisma.learnerSkill.findMany({
    where: { reps: { gt: 0 }, skillId: { in: pool }, userId },
  });

  const studiedBySkill = new Map(studied.map((row) => [row.skillId, row]));

  const recalls = pool.flatMap((skillId) => {
    const memory = studiedBySkill.get(skillId);

    return memory ? [{ recall: getSkillRetrievability({ memory, now }) ?? 0, skillId }] : [];
  });

  const unstudied = pool
    .filter(
      (skillId) =>
        (everySkill || claimed.has(skillId) || firstSkillIds.has(skillId)) &&
        !studiedBySkill.has(skillId),
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

  // Unconfirmed claims need one question, not a whole set; listening recordings are indivisible.
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
