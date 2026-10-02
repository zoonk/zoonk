import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { type TrueFalseLabels, getTrueFalseLabels } from "../../library/exams/true-false-labels";
import { loadExamStructure } from "../../sessions/_utils/load-build-inputs";
import { type QuestionView, parseChoiceItem, toQuestionView } from "../_utils/choice-items";
import { loadGoalPlan } from "../_utils/goal-skill-graph";
import { findOwnedGoal } from "../_utils/owned-goal";
import { pickPlacementItem } from "../placement/placement-steps";
import { getChapterSkills, loadSkillItems } from "./_utils/chapter-items";
import { TEST_OUT_PASS_MARK, pickTestOutSkills } from "./test-out-rules";

type ChapterTestOut = {
  chapterId: string;
  /**
   * Sampled skills with no question to ask yet: `POST .../test-out/generations` writes them when
   * the learner asks (`requestTestOutQuestions`).
   */
  needsItems: string[];
  passMark: number;
  questions: QuestionView[];
  /** The words the goal's true-or-false statements are answered with, by its exam. */
  trueFalseLabels: TrueFalseLabels;
};

export type ChapterTestOutResult =
  | { status: "notFound" }
  | { status: "ready"; testOut: ChapterTestOut }
  | { status: "unauthorized" };

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
  const chapterSkills = getChapterSkills({ chapterId, plan: await loadGoalPlan(goal.id) });

  if (chapterSkills.length === 0) {
    return null;
  }

  const sampled = pickTestOutSkills(chapterSkills);

  const [items, structure] = await Promise.all([
    loadSkillItems({
      examBlueprintId: goal.examBlueprintId,
      skillIds: sampled.map((skill) => skill.id),
      userId,
    }),
    loadExamStructure(goal),
  ]);

  const picks = sampled.map((skill) => ({
    item:
      pickPlacementItem({ confirming: false, items, skillId: skill.id }) ??
      items.find((item) => item.skillId === skill.id) ??
      null,
    skillId: skill.id,
  }));

  const pickedIds = picks.flatMap((pick) => (pick.item ? [pick.item.id] : []));
  const rows = await prisma.item.findMany({ where: { id: { in: pickedIds } } });

  const questions = pickedIds
    .map((id) => rows.find((row) => row.id === id))
    .map((row) => (row ? parseChoiceItem(row) : null))
    .filter((item) => item !== null)
    .map((item) => toQuestionView(item));

  return {
    chapterId,
    needsItems: picks.filter((pick) => !pick.item).map((pick) => pick.skillId),
    passMark: TEST_OUT_PASS_MARK,
    questions,
    trueFalseLabels: getTrueFalseLabels(structure),
  };
}

/**
 * Builds the test-out for one chapter of a goal's plan: one question per sampled skill, spread over
 * the chapter, unseen questions first. Nothing is stored until the learner submits the answers.
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
