import { type CefrLevel } from "@zoonk/utils/cefr";
import { isLowGuessTap } from "../../../learner/_utils/placement-guess-rate";
import {
  LEVEL_TEST_CHECK_PER_SKILL,
  type LevelTestBank,
  type LevelTestConfirmation,
} from "../level-test-contract";

const QUESTION_SKILLS = ["reading", "listening"] as const;

export function listLevelConfirmations({
  bank,
  level,
}: {
  bank: LevelTestBank;
  level: CefrLevel;
}): LevelTestConfirmation[] {
  const eligible = (bank.confirmations ?? []).filter(
    (question) =>
      question.level === level &&
      isLowGuessTap({
        content: { options: question.options, select: "all" },
        format: "multipleChoice",
      }),
  );

  return QUESTION_SKILLS.flatMap((skill) =>
    eligible.filter((question) => question.skill === skill).slice(0, LEVEL_TEST_CHECK_PER_SKILL),
  );
}

export function hasCompleteLevelCheck(questions: readonly LevelTestConfirmation[]) {
  return (
    new Set(questions.map(({ id }) => id)).size >=
      LEVEL_TEST_CHECK_PER_SKILL * QUESTION_SKILLS.length &&
    QUESTION_SKILLS.every(
      (skill) =>
        new Set(questions.filter((item) => item.skill === skill).map(({ id }) => id)).size >=
        LEVEL_TEST_CHECK_PER_SKILL,
    )
  );
}
