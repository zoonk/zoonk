import "server-only";
import { prisma } from "@zoonk/db";
import { after } from "next/server";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { gradeChoiceAnswer, parseChoiceItem } from "../_utils/choice-items";
import { loadGoalPlan } from "../_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../_utils/known-skills";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { type ItemAnswerInput } from "../contract";
import { recordLearnerAnswer } from "../record-learner-answer";
import { getChapterSkills, loadSkillItems } from "./_utils/chapter-items";
import { type ChapterTestOutInput } from "./test-out-contract";
import { type TestOutScore, scoreTestOut } from "./test-out-rules";

const PERCENT = 100;

type ChapterTestOutOutcome = TestOutScore & {
  answers: { isCorrect: boolean; itemId: string }[];
  testedOutPlanItemIds: string[];
};

export type SubmitChapterTestOutResult =
  | { outcome: ChapterTestOutOutcome; status: "ready" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "unauthorized" };

function firstAnswerPerItem(answers: readonly ItemAnswerInput[]): ItemAnswerInput[] {
  return answers.filter(
    (answer, index) => answers.findIndex((other) => other.itemId === answer.itemId) === index,
  );
}

/**
 * Grades a chapter test-out and records every answer as diagnostic. Passing marks the chapter's
 * skills known (except any the learner missed) and tests out the plan items that teach only known
 * skills, so the plan skips them. Every answered question must belong to the chapter.
 */
export async function submitChapterTestOut({
  chapterId,
  goalId,
  input,
}: {
  chapterId: string;
  goalId: string;
  input: ChapterTestOutInput;
}): Promise<SubmitChapterTestOutResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const plan = await loadGoalPlan(goalId);
  const chapterSkillIds = getChapterSkills({ chapterId, plan }).map((skill) => skill.id);

  if (chapterSkillIds.length === 0) {
    return { status: "notFound" };
  }

  const answers = firstAnswerPerItem(input.answers);

  const [rows, chapterItems] = await Promise.all([
    prisma.item.findMany({ where: { id: { in: answers.map((answer) => answer.itemId) } } }),
    loadSkillItems({
      examBlueprintId: owned.goal.examBlueprintId,
      skillIds: chapterSkillIds,
      userId: owned.userId,
    }),
  ]);

  const graded = answers.map((answer) => {
    const row = rows.find((candidate) => candidate.id === answer.itemId);
    const item = row && chapterSkillIds.includes(row.skillId) ? parseChoiceItem(row) : null;

    return {
      answer,
      item,
      result: item ? gradeChoiceAnswer({ answer: answer.answer, item }) : null,
    };
  });

  if (graded.some((entry) => !entry.item)) {
    return { status: "invalidItem" };
  }

  const answeredAt = new Date();
  const timeZone = getAnswerTimeZone({ goal: owned.goal, timeZone: input.timeZone });

  await Promise.all(
    graded.flatMap(({ answer, item, result }) =>
      item && result
        ? [
            recordLearnerAnswer({
              answer: answer.answer,
              answeredAt,
              graded: { durationMs: answer.durationMs, isCorrect: result.isCorrect },
              itemId: item.id,
              language: item.language,
              purpose: "diagnostic",
              skillId: item.skillId,
              timeZone,
              userId: owned.userId,
            }),
          ]
        : [],
    ),
  );

  const score = scoreTestOut({
    chapterSkillIds,
    results: graded.map(({ item, result }) => ({
      isCorrect: result?.isCorrect ?? false,
      skillId: item?.skillId ?? "",
    })),
    testableSkillCount: new Set(chapterItems.map((item) => item.skillId)).size,
  });

  if (score.passed) {
    await markSkillsKnown({
      knownAt: answeredAt,
      skillIds: score.knownSkillIds,
      timeZone,
      userId: owned.userId,
    });
  }

  const testedOutPlanItemIds = score.passed
    ? await markPlanItemsTestedOut({
        goalId,
        items: plan.items,
        knownSkillIds: new Set(score.knownSkillIds),
        testedOutAt: answeredAt,
        timeZone,
      })
    : [];

  revalidateCacheTags([getLearnerModelCacheTag(owned.userId)]);

  after(() =>
    trackLearnerEvents({
      events: [
        {
          name: "Test-out Taken",
          properties: {
            chapter_id: chapterId,
            passed: score.passed,
            score: score.total > 0 ? Math.round((score.correct / score.total) * PERCENT) : 0,
          },
        },
      ],
      goalId,
      userId: owned.userId,
    }),
  );

  return {
    outcome: {
      ...score,
      answers: graded.map(({ answer, result }) => ({
        isCorrect: result?.isCorrect ?? false,
        itemId: answer.itemId,
      })),
      testedOutPlanItemIds,
    },
    status: "ready",
  };
}
