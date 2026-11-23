import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type TrueFalseLabels, getTrueFalseLabels } from "../../library/exams/true-false-labels";
import { ITEM_IMAGE_INCLUDE } from "../../library/items/item-image";
import { loadExamStructure } from "../../sessions/_utils/exam-structure";
import { findOwnedGoal } from "../_utils/owned-goal";
import { isLowGuessTap, isQuickChoice } from "../_utils/placement-guess-rate";
import { type SavedPlan, readSavedPlan } from "../facts/saved-plan";
import {
  type PlacementQuestionView,
  parsePlacementItem,
  toPlacementQuestionView,
} from "../placement/_utils/placement-items";
import { getChapterTestOutSkills, loadSkillItems } from "./_utils/chapter-items";
import { loadTestOutPlan } from "./_utils/test-out-plan";
import {
  TEST_OUT_PASS_MARK,
  TEST_OUT_QUESTIONS_PER_SKILL,
  pickTestOutSkills,
} from "./test-out-rules";

type ChapterTestOut = {
  chapterId: string;
  /** The chapter's name, for a screen opened from somewhere that doesn't know it (Today's lesson row). */
  chapterTitle: string;
  /** Request test-out generation when this list is nonempty. */
  needsItems: string[];
  passMark: number;
  /** Empty until every sampled skill has its required share of questions. */
  questions: PlacementQuestionView[];
  /** How many questions each sampled skill needs: several when the chapter has few skills. */
  questionsPerSkill: number;
  trueFalseLabels: TrueFalseLabels;
};

export type ChapterTestOutResult =
  | { status: "notFound" }
  | { status: "nothingToSkip" }
  | { status: "ready"; testOut: ChapterTestOut }
  | { status: "unauthorized" };

function pickSkillItems({
  items,
  skillId,
}: {
  items: Awaited<ReturnType<typeof loadSkillItems>>;
  skillId: string;
}): string[] {
  const unseen = items.filter((item) => item.skillId === skillId && !item.seen);
  const quick = unseen.find((item) => isQuickChoice(item));
  const lowGuess = unseen.filter((item) => isLowGuessTap(item));

  return quick
    ? [quick, ...lowGuess.slice(0, TEST_OUT_QUESTIONS_PER_SKILL - 1)].map((item) => item.id)
    : [];
}

function interleave(picks: readonly { itemIds: string[] }[]): string[] {
  const rounds = Math.max(0, ...picks.map((pick) => pick.itemIds.length));

  return Array.from({ length: rounds }).flatMap((_, round) =>
    picks.flatMap((pick) => pick.itemIds[round] ?? []),
  );
}

/** Caller must verify goal ownership before supplying userId. */
export async function loadChapterTestOut({
  chapterId,
  goal,
  savedPlan,
  userId,
}: {
  chapterId: string;
  goal: Pick<Goal, "createdAt" | "examBlueprintId" | "id" | "kind" | "targetLanguage" | "timezone">;
  /** Only GET callers supply request facts; generation preconditions read the plan fresh. */
  savedPlan?: Promise<SavedPlan | null>;
  userId: string;
}): Promise<Exclude<ChapterTestOutResult, { status: "unauthorized" }>> {
  const plan = await loadTestOutPlan(goal.id, { goal, source: savedPlan });
  const eligible = getChapterTestOutSkills({ chapterId, plan });

  if (eligible.status !== "ready") {
    return eligible;
  }

  const sampled = pickTestOutSkills(eligible.skills);

  const questionsPerSkill = TEST_OUT_QUESTIONS_PER_SKILL;

  const [items, structure, chapter] = await Promise.all([
    loadSkillItems({
      examBlueprintId: goal.examBlueprintId,
      skillIds: sampled.map((skill) => skill.id),
      userId,
    }),
    loadExamStructure(goal),
    prisma.chapter.findUnique({ select: { title: true }, where: { id: chapterId } }),
  ]);

  if (!chapter) {
    return { status: "notFound" };
  }

  const picks = sampled.map((skill) => ({
    itemIds: pickSkillItems({ items, skillId: skill.id }),
    skillId: skill.id,
  }));

  const needsItems = picks
    .filter((pick) => pick.itemIds.length < questionsPerSkill)
    .map((pick) => pick.skillId);

  const pickedIds = needsItems.length > 0 ? [] : interleave(picks);

  const rows = await prisma.item.findMany({
    include: ITEM_IMAGE_INCLUDE,
    where: { id: { in: pickedIds } },
  });

  const questions = pickedIds
    .map((id) => rows.find((row) => row.id === id))
    .map((row) => (row ? parsePlacementItem(row) : null))
    .filter((item) => item !== null)
    .map((item) => toPlacementQuestionView(item));

  return {
    status: "ready",
    testOut: {
      chapterId,
      chapterTitle: chapter.title,
      needsItems,
      passMark: TEST_OUT_PASS_MARK,
      questions,
      questionsPerSkill,
      trueFalseLabels: getTrueFalseLabels(structure),
    },
  };
}

/** Read-only until submission; returns no questions until every sampled skill has its required share. */
export async function getChapterTestOut({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId: string;
}): Promise<ChapterTestOutResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  return loadChapterTestOut({
    chapterId,
    goal: owned.goal,
    savedPlan: readSavedPlan(owned.userId, goalId),
    userId: owned.userId,
  });
}
