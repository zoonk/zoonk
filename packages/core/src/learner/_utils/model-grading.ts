import "server-only";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { claimGuestShare } from "../../entitlements/_utils/guest-spend-budget";
import { TYPED_GRADE_COST_MICROS } from "../../entitlements/limits";
import { unchanged, writeLearnerChange } from "./write-learner-change";

/** Grading has a per-question cap instead of spending small AI help, since opened lessons already bound it. */
const MAX_MODEL_GRADED_ANSWERS_PER_DAY = 5;

type AnsweredQuestion = { itemId: string } | { stepId: string };

/**
 * Claims one of the question's model grades for a rolling day, under the learner's lock and before
 * the call, so answers sent at once can't each pass the cap. A guest's also takes from the day all
 * guests share. False means grade by code.
 */
export async function claimModelGrade({
  question,
  userId,
}: {
  question: AnsweredQuestion;
  userId: string;
}): Promise<boolean> {
  const questionId = "stepId" in question ? question.stepId : question.itemId;

  return writeLearnerChange({ userId }, async (tx) => {
    const graded = await tx.modelGrade.count({
      where: { createdAt: { gte: new Date(Date.now() - MS_PER_DAY) }, questionId, userId },
    });

    if (
      graded >= MAX_MODEL_GRADED_ANSWERS_PER_DAY ||
      !(await claimGuestShare({ costMicros: TYPED_GRADE_COST_MICROS, transaction: tx, userId }))
    ) {
      return unchanged(false);
    }

    await tx.modelGrade.create({ data: { questionId, userId } });
    return true;
  });
}
