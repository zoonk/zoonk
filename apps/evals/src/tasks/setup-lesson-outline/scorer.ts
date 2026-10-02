import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";

/** Case-insensitive patterns the title must match: the tool, and the device as people say it. */
export type SetupLessonOutlineExpected = { device: string; tool: string };

type SetupOutline = {
  canDo: string;
  description: string;
  estimatedMinutes: number;
  skill: string;
  title: string;
};

const MAX_SKILL_WORDS = 8;
const MAX_CAN_DO_WORDS = 12;
const MAX_DESCRIPTION_WORDS = 35;
const MIN_MINUTES = 3;
const MAX_MINUTES = 5;
const MIN_SCORE = 1;
const MAX_SCORE = 10;

function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function parseOutline(output: string): SetupOutline | null {
  try {
    return JSON.parse(output) as SetupOutline;
  } catch {
    return null;
  }
}

/** One problem per rule the outline breaks; the lesson pipeline reads these fields as they are. */
function getProblems({
  expected,
  outline,
}: {
  expected: SetupLessonOutlineExpected;
  outline: SetupOutline;
}): string[] {
  const tool = new RegExp(expected.tool, "iu");
  const device = new RegExp(expected.device, "iu");

  return [
    !tool.test(outline.title) && `The title "${outline.title}" doesn't name the tool.`,
    !device.test(outline.title) && `The title "${outline.title}" doesn't name the device.`,
    (!tool.test(outline.skill) || countWords(outline.skill) > MAX_SKILL_WORDS) &&
      `The skill "${outline.skill}" should name the tool in up to ${MAX_SKILL_WORDS} words.`,
    (outline.canDo.trim() === "" || countWords(outline.canDo) > MAX_CAN_DO_WORDS) &&
      `The can-do line "${outline.canDo}" should be up to ${MAX_CAN_DO_WORDS} words.`,
    countWords(outline.description) > MAX_DESCRIPTION_WORDS &&
      `The description runs ${countWords(outline.description)} words; it should be one sentence.`,
    (outline.estimatedMinutes < MIN_MINUTES || outline.estimatedMinutes > MAX_MINUTES) &&
      `The lesson takes ${outline.estimatedMinutes} minutes instead of 3 to 5.`,
  ].filter((problem) => typeof problem === "string");
}

const RULE_COUNT = 6;

/**
 * Code checks only: the title names the tool and the device, and every field fits what the
 * lesson pipeline and session tiles expect. The score is the share of rules the outline meets.
 */
export const scoreSetupLessonOutline: TaskScorer<SetupLessonOutlineExpected> = ({
  output,
  testCase,
}) => {
  const outline = parseOutline(output);

  if (!outline || !testCase.expected) {
    return createFixedScore({ conclusion: "The output isn't a setup outline.", score: MIN_SCORE });
  }

  const problems = getProblems({ expected: testCase.expected, outline });
  const passRate = (RULE_COUNT - problems.length) / RULE_COUNT;

  return createFixedScore({
    conclusion: problems.length === 0 ? "Every rule passed." : problems.join(" "),
    score: MIN_SCORE + (MAX_SCORE - MIN_SCORE) * passRate,
  });
};
