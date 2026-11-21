import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type LevelTestConfirmation } from "@zoonk/ai/tasks/language/level-test-confirmations";
import {
  LEVEL_TEST_PASSAGE_WORDS,
  LEVEL_TEST_SKILLS,
} from "@zoonk/ai/tasks/language/level-test-levels";
import { LEVEL_TEST_CONFIRMATIONS_SCORE_CATEGORIES } from "./score-categories";

const PER_SKILL = 2;

function countWords(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

/** The writer already drops a question that can't confirm a level, so a missing one is a failure. */
function getProblems(confirmation: LevelTestConfirmation): string[] {
  const { level, skill } = confirmation;
  const maxWords = LEVEL_TEST_PASSAGE_WORDS[level][skill].max;
  const words = countWords(confirmation.passage);

  return words > maxWords
    ? [`${level} ${skill}: the text has ${words} words, over ${maxWords}.`]
    : [];
}

export const checkLevelTestConfirmations: TaskCodeChecks = ({ output }) => {
  const { confirmations } = JSON.parse(output) as { confirmations: LevelTestConfirmation[] };

  const parts = LEVEL_TEST_SKILLS.map((skill) => {
    const written = confirmations.filter((confirmation) => confirmation.skill === skill);

    return [
      ...(written.length === PER_SKILL
        ? []
        : [`${skill}: ${written.length} usable questions instead of ${PER_SKILL}.`]),
      ...written.flatMap((confirmation) => getProblems(confirmation)),
    ];
  });

  return {
    judgedOutput: output,
    passed: parts.filter((problems) => problems.length === 0).length,
    problems: parts.flat(),
    total: parts.length,
  };
};

export const scoreLevelTestConfirmations: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkLevelTestConfirmations({ output: value, testCase }),
    output,
    scoreCategories: LEVEL_TEST_CONFIRMATIONS_SCORE_CATEGORIES,
    testCase,
  });
