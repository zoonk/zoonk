import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type TrueFalseLabels, getTrueFalseLabels } from "../../library/exams/true-false-labels";
import { ITEM_IMAGE_INCLUDE } from "../../library/items/item-image";
import { loadExamStructure } from "../../sessions/_utils/exam-structure";
import { type QuestionView, parseChoiceItem, toQuestionView } from "../_utils/choice-items";
import { findOwnedGoal } from "../_utils/owned-goal";
import { type SavedPlan, readSavedPlan } from "../facts/saved-plan";
import { pickPlacementItem } from "../placement/placement-item-choice";
import { countSkippableItems, getChapterSkills, loadSkillItems } from "./_utils/chapter-items";
import { isTestOutPlusOnly } from "./_utils/test-out-access";
import { loadTestOutPlan } from "./_utils/test-out-plan";
import {
  TEST_OUT_PASS_MARK,
  getQuestionsPerSkill,
  getTestOutQuestionCount,
  pickTestOutSkills,
} from "./test-out-rules";

type ChapterTestOut = {
  chapterId: string;
  /** Request test-out generation when this list is nonempty. */
  needsItems: string[];
  passMark: number;
  /** Empty until every sampled skill has its required share of questions. */
  questions: QuestionView[];
  /** How many questions each sampled skill needs: several when the chapter has few skills. */
  questionsPerSkill: number;
  trueFalseLabels: TrueFalseLabels;
};

export type ChapterTestOutResult =
  | { status: "notFound" }
  | { status: "nothingToSkip" }
  | { status: "plusRequired" }
  | { status: "ready"; testOut: ChapterTestOut }
  | { status: "unauthorized" };

function pickSkillItems({
  count,
  items,
  skillId,
}: {
  count: number;
  items: Awaited<ReturnType<typeof loadSkillItems>>;
  skillId: string;
}): string[] {
  const picked = Array.from({ length: count }).reduce<string[]>((ids) => {
    const left = items.filter((item) => !ids.includes(item.id));
    const next = pickPlacementItem({ confirming: false, items: left, skillId });
    return next ? [...ids, next.id] : ids;
  }, []);

  const seen = items
    .filter((item) => item.skillId === skillId && !picked.includes(item.id))
    .map((item) => item.id);

  return [...picked, ...seen].slice(0, count);
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
  goal: Pick<Goal, "createdAt" | "examBlueprintId" | "id" | "kind" | "timezone">;
  /** Only GET callers supply request facts; generation preconditions read the plan fresh. */
  savedPlan?: Promise<SavedPlan | null>;
  userId: string;
}): Promise<Exclude<ChapterTestOutResult, { status: "unauthorized" }>> {
  const plan = await loadTestOutPlan(goal.id, { goal, source: savedPlan });
  const chapterSkills = getChapterSkills({ chapterId, plan });

  if (chapterSkills.length === 0) {
    return { status: "notFound" };
  }

  const skippable = countSkippableItems({ plan, skills: chapterSkills });

  if (skippable === 0) {
    return { status: "nothingToSkip" };
  }

  if (await isTestOutPlusOnly(goal)) {
    return { status: "plusRequired" };
  }

  const sampled = pickTestOutSkills(chapterSkills);

  const count = Math.max(sampled.length, getTestOutQuestionCount(skippable));

  const questionsPerSkill = getQuestionsPerSkill({ questions: count, skills: sampled.length });

  const [items, structure] = await Promise.all([
    loadSkillItems({
      examBlueprintId: goal.examBlueprintId,
      skillIds: sampled.map((skill) => skill.id),
      userId,
    }),
    loadExamStructure(goal),
  ]);

  const picks = sampled.map((skill) => ({
    itemIds: pickSkillItems({ count: questionsPerSkill, items, skillId: skill.id }),
    skillId: skill.id,
  }));

  const needsItems = picks
    .filter((pick) => pick.itemIds.length < questionsPerSkill)
    .map((pick) => pick.skillId);

  const pickedIds = needsItems.length > 0 ? [] : interleave(picks).slice(0, count);

  const rows = await prisma.item.findMany({
    include: ITEM_IMAGE_INCLUDE,
    where: { id: { in: pickedIds } },
  });

  const questions = pickedIds
    .map((id) => rows.find((row) => row.id === id))
    .map((row) => (row ? parseChoiceItem(row) : null))
    .filter((item) => item !== null)
    .map((item) => toQuestionView(item));

  return {
    status: "ready",
    testOut: {
      chapterId,
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
