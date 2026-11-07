import { scoreWithCodeChecks } from "@/lib/code-checked-score";
import { type TaskCodeChecks, type TaskScorer } from "@/lib/types";
import { toIconNeed } from "@zoonk/ai/tasks/icons/need";
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

type AskedScreens = ReadonlyMap<number, RawOutput["screens"][number]>;

/**
 * Normalizing drops a usable icon only when it repeats its idea's, or an earlier idea's. A screen
 * may go without one; an idea may not.
 */
function iconProblem({
  asked,
  kept,
  repeated,
}: {
  asked: Parameters<typeof toIconNeed>[0];
  kept: unknown;
  repeated: string;
}): string | null {
  if (kept) {
    return null;
  }

  return toIconNeed(asked) ? repeated : "no usable icon";
}

/** Normalizing drops an idea in the map's range only when it would go back in the map's order. */
function findHiddenIdea({
  asked,
  ideaCount,
  kept,
}: {
  asked: number | null | undefined;
  ideaCount: number;
  kept: number | null | undefined;
}): number | null {
  return typeof asked === "number" && asked >= 1 && asked <= ideaCount && kept === null
    ? asked - 1
    : null;
}

function ideaProblem({
  asked,
  ideaCount,
  kept,
}: {
  asked: number | null | undefined;
  ideaCount: number;
  kept: number | null | undefined;
}): string | null {
  if (typeof asked !== "number" || kept !== null) {
    return null;
  }

  return findHiddenIdea({ asked, ideaCount, kept }) === null
    ? "idea number out of range"
    : "idea goes back in the map's order";
}

/** Shows the judge each idea hidden for going back, so it still judges the model's choice there. */
function toJudgedMarks({
  askedScreens,
  input,
  marks,
}: {
  askedScreens: AskedScreens;
  input: MarksInput;
  marks: LessonMarks;
}) {
  return {
    ...marks,
    screens: marks.screens.map((screen, index) => {
      const hiddenIdeaIndex = findHiddenIdea({
        asked: askedScreens.get(index + 1)?.idea,
        ideaCount: input.ideas.length,
        kept: screen.ideaIndex,
      });

      return hiddenIdeaIndex === null ? screen : { ...screen, hiddenIdeaIndex };
    }),
  };
}

function screenProblems({
  askedScreens,
  input,
  marks,
}: {
  askedScreens: AskedScreens;
  input: MarksInput;
  marks: LessonMarks;
}): string[] {
  return input.screens.flatMap((screen, index) => {
    const asked = askedScreens.get(index + 1);
    const kept = marks.screens[index];
    const label = `Screen ${index + 1}`;

    const icon =
      canScreenGetIcon(screen) && asked?.icon
        ? iconProblem({ asked: asked.icon, kept: kept?.icon, repeated: "repeats its idea's icon" })
        : null;

    const idea = ideaProblem({
      asked: asked?.idea,
      ideaCount: input.ideas.length,
      kept: kept?.ideaIndex,
    });

    return [
      asked ? null : `${label}: left out`,
      asked?.underline && !kept?.underline ? `${label}: underline isn't an exact quote` : null,
      asked?.example && !kept?.example ? `${label}: example isn't whole exact sentences` : null,
      icon ? `${label}: ${icon}` : null,
      idea ? `${label}: ${idea}` : null,
    ].filter((problem) => problem !== null);
  });
}

function ideaProblems({
  input,
  marks,
  raw,
}: {
  input: MarksInput;
  marks: LessonMarks;
  raw: RawOutput;
}): string[] {
  return input.ideas.flatMap((_idea, index) => {
    const asked = raw.ideas.find((item) => item.idea === index + 1);
    const kept = marks.ideas[index];
    const label = `Idea ${index + 1}`;

    const icon = iconProblem({
      asked: asked?.icon,
      kept: kept?.icon,
      repeated: "same icon as an earlier idea",
    });

    return [
      kept?.about ? null : `${label}: no usable about line`,
      icon ? `${label}: ${icon}` : null,
    ].filter((problem) => problem !== null);
  });
}

export const checkLessonMarks: TaskCodeChecks = ({ output, testCase }) => {
  const input = testCase.userInput as MarksInput;
  const { raw } = JSON.parse(output) as LessonMarksEvalOutput;
  const marks = normalizeLessonMarks({ ideas: input.ideas, output: raw, screens: input.screens });

  // Normalizing reads a screen's last row when the model repeats one, so the checks do too.
  const askedScreens: AskedScreens = new Map(raw.screens.map((item) => [item.screen, item]));

  const problems = [
    ...screenProblems({ askedScreens, input, marks }),
    ...ideaProblems({ input, marks, raw }),
  ];

  const total = input.screens.length + input.ideas.length;
  const failing = new Set(problems.map((problem) => problem.split(":")[0]));

  return {
    judgedOutput: JSON.stringify(toJudgedMarks({ askedScreens, input, marks }), null, 2),
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
