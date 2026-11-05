import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { type LessonMarksParams } from "@zoonk/ai/tasks/lesson-marks";
import {
  type LessonMarks,
  canScreenGetIcon,
  normalizeLessonMarks,
} from "@zoonk/ai/tasks/lesson-marks/schema";
import { LESSON_MARKS_SCORE_CATEGORIES } from "./score-categories";

type RawOutput = Parameters<typeof normalizeLessonMarks>[0]["output"];

export type LessonMarksEvalOutput = { marks: LessonMarks; raw: RawOutput };

type MarksInput = Pick<LessonMarksParams, "ideas" | "screens">;

function screenProblems({
  input,
  marks,
  raw,
}: {
  input: MarksInput;
  marks: LessonMarks;
  raw: RawOutput;
}): string[] {
  return input.screens.flatMap((screen, index) => {
    const asked = raw.screens.find((item) => item.screen === index + 1);
    const kept = marks.screens[index];
    const label = `Screen ${index + 1}`;

    return [
      asked ? null : `${label}: left out`,
      asked?.underline && !kept?.underline ? `${label}: underline isn't an exact quote` : null,
      asked?.example && !kept?.example ? `${label}: example isn't whole exact sentences` : null,
      canScreenGetIcon(screen) && !kept?.icon ? `${label}: no usable icon where one belongs` : null,
      typeof asked?.idea === "number" && kept?.ideaIndex === null
        ? `${label}: idea number out of range`
        : null,
    ].filter((problem) => problem !== null);
  });
}

function ideaProblems({ input, marks }: { input: MarksInput; marks: LessonMarks }): string[] {
  return input.ideas.flatMap((_idea, index) => {
    const kept = marks.ideas[index];
    const label = `Idea ${index + 1}`;

    return [
      kept?.about ? null : `${label}: no usable about line`,
      kept?.icon ? null : `${label}: no usable icon`,
    ].filter((problem) => problem !== null);
  });
}

export const checkLessonMarks: TaskCodeChecks = ({ output, testCase }) => {
  const input = testCase.userInput as MarksInput;
  const { raw } = JSON.parse(output) as LessonMarksEvalOutput;
  const marks = normalizeLessonMarks({ ideas: input.ideas, output: raw, screens: input.screens });
  const problems = [...screenProblems({ input, marks, raw }), ...ideaProblems({ input, marks })];
  const total = input.screens.length + input.ideas.length;
  const failing = new Set(problems.map((problem) => problem.split(":")[0]));

  return {
    judgedOutput: JSON.stringify(marks, null, 2),
    passed: total - failing.size,
    problems,
    total,
  };
};

export const scoreLessonMarks: TaskScorer = ({ output, testCase }) =>
  scoreWithCodeChecks({
    check: (value) => checkLessonMarks({ output: value, testCase }),
    output,
    scoreCategories: LESSON_MARKS_SCORE_CATEGORIES,
    testCase,
  });
