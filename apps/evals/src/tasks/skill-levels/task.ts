import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import {
  type SkillLevel,
  type SkillLevelsParams,
  classifySkillLevels,
} from "@zoonk/ai/tasks/language/skill-levels";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { TEST_CASES } from "./test-cases";

export type SkillLevelsExpected = { levels: Record<string, CefrLevel> };

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

function parseLevels(output: string): Map<string, CefrLevel> | null {
  try {
    const parsed = JSON.parse(output) as { levels: SkillLevel[] };
    return new Map(parsed.levels.map((skill) => [skill.id, skill.level]));
  } catch {
    return null;
  }
}

/** Scores the labeled skills only; a skill the model left untagged counts as wrong. */
const scoreSkillLevels: TaskScorer<SkillLevelsExpected> = ({ output, testCase }) => {
  const levels = parseLevels(output);
  const expected = Object.entries(testCase.expected?.levels ?? {});

  if (!levels || expected.length === 0) {
    return createFixedScore({ conclusion: "Invalid output", score: MIN_SCORE });
  }

  const wrong = expected.filter(([id, level]) => levels.get(id) !== level);

  return createFixedScore({
    conclusion: `${expected.length - wrong.length}/${expected.length} right${
      wrong.length > 0
        ? `. Wrong: ${wrong.map(([id, level]) => `${id} (${levels.get(id) ?? "none"}, expected ${level})`).join(", ")}`
        : ""
    }`,
    score: MIN_SCORE + (SCORE_RANGE * (expected.length - wrong.length)) / expected.length,
  });
};

export const skillLevelsTask: Task<
  Omit<SkillLevelsParams, "model">,
  { levels: SkillLevel[] },
  SkillLevelsExpected
> = {
  description: "Place each language skill at the lower or upper level of its CEFR band",
  generate: classifySkillLevels,
  id: "skill-levels",
  name: "Skill Levels",
  score: scoreSkillLevels,
  testCases: TEST_CASES,
};
