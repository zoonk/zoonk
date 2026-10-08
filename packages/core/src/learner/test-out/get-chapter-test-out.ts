import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type TrueFalseLabels, getTrueFalseLabels } from "../../library/exams/true-false-labels";
import { ITEM_IMAGE_INCLUDE } from "../../library/items/item-image";
import { loadExamStructure } from "../../sessions/_utils/load-build-inputs";
import { type QuestionView, parseChoiceItem, toQuestionView } from "../_utils/choice-items";
import { loadGoalPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal } from "../_utils/owned-goal";
import { pickPlacementItem } from "../placement/placement-item-choice";
import { countSkippableItems, getChapterSkills, loadSkillItems } from "./_utils/chapter-items";
import {
  TEST_OUT_PASS_MARK,
  getQuestionsPerSkill,
  getTestOutQuestionCount,
  pickTestOutSkills,
} from "./test-out-rules";

type ChapterTestOut = {
  chapterId: string;
  /**
   * Sampled skills with no question to ask yet: `POST .../test-out/generations` writes them when
   * the learner asks (`requestTestOutQuestions`).
   */
  needsItems: string[];
  passMark: number;
  /**
   * The sampled skills' questions, spread over them, or none while `needsItems` lists any: a
   * test-out can only pass with enough answers on every sampled skill, so it doesn't start on some.
   */
  questions: QuestionView[];
  /** How many questions each sampled skill needs: several when the chapter has few skills. */
  questionsPerSkill: number;
  /** The words the goal's true-or-false statements are answered with, by its exam. */
  trueFalseLabels: TrueFalseLabels;
};

export type ChapterTestOutResult =
  | { status: "notFound" }
  | { status: "ready"; testOut: ChapterTestOut }
  | { status: "unauthorized" };

/**
 * A skill's questions for the test: unseen ones first, picked the way placement picks, then ones
 * the learner answered before.
 */
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

/** One question per skill in turn, so the test moves across the chapter. */
function interleave(picks: readonly { itemIds: string[] }[]): string[] {
  const rounds = Math.max(0, ...picks.map((pick) => pick.itemIds.length));

  return Array.from({ length: rounds }).flatMap((_, round) =>
    picks.flatMap((pick) => pick.itemIds[round] ?? []),
  );
}

/**
 * The test-out for one chapter of the learner's own goal, or null when the chapter isn't in its
 * plan. For the capabilities that read it after checking the goal is the learner's.
 */
export async function loadChapterTestOut({
  chapterId,
  goal,
  userId,
}: {
  chapterId: string;
  goal: Pick<Goal, "examBlueprintId" | "id">;
  userId: string;
}): Promise<ChapterTestOut | null> {
  const plan = await loadGoalPlan(goal.id);
  const chapterSkills = getChapterSkills({ chapterId, plan });

  if (chapterSkills.length === 0) {
    return null;
  }

  const sampled = pickTestOutSkills(chapterSkills);

  // Every sampled skill gets a question, and a chapter of few skills asks them more than once.
  const count = Math.max(
    sampled.length,
    getTestOutQuestionCount(countSkippableItems({ plan, skills: chapterSkills })),
  );

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
    chapterId,
    needsItems,
    passMark: TEST_OUT_PASS_MARK,
    questions,
    questionsPerSkill,
    trueFalseLabels: getTrueFalseLabels(structure),
  };
}

/**
 * Builds the test-out for one chapter of a goal's plan: four to eight questions, more the more
 * lessons a pass skips, spread over the chapter's sampled skills (a chapter of one skill asks it
 * several times), unseen questions first, once every sampled skill has its share. Nothing is
 * stored until the learner submits the answers.
 */
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

  const testOut = await loadChapterTestOut({ chapterId, goal: owned.goal, userId: owned.userId });
  return testOut ? { status: "ready", testOut } : { status: "notFound" };
}
