import { createFixedScore } from "@/lib/score";
import { type Task, type TaskScorer } from "@/lib/types";
import { findTaskSubjects } from "@zoonk/core/library/exams/written-task-subjects";
import {
  type TaskSubjectsEvalInput,
  type TaskSubjectsEvalOutput,
  generateTaskSubjects,
} from "./generate";
import { TEST_CASES } from "./test-cases";

/** Each task id's subjects, as the names they stand for resolve; empty when the documents tie it to none. */
export type TaskSubjectsExpected = Record<string, string[]>;

const MIN_SCORE = 2;
const SCORE_RANGE = 8;
const FACT_WEIGHT = 0.8;
const PASSAGE_WEIGHT = 0.2;

function parseOutput(output: string): TaskSubjectsEvalOutput | null {
  try {
    return JSON.parse(output) as TaskSubjectsEvalOutput;
  } catch {
    return null;
  }
}

function resolve({
  input,
  output,
  task,
}: {
  input: TaskSubjectsEvalInput;
  output: TaskSubjectsEvalOutput;
  task: string;
}): string[] {
  const names = output.links.filter((link) => link.task === task).flatMap((link) => link.subjects);

  return findTaskSubjects({ names, subjects: input.subjects })
    .map((subject) => subject.name)
    .toSorted();
}

const scoreTaskSubjects: TaskScorer<TaskSubjectsExpected> = ({ output, testCase }) => {
  const parsed = parseOutput(output);
  const expected = testCase.expected;

  if (!parsed?.links || !expected) {
    return createFixedScore({ conclusion: "Invalid output", score: MIN_SCORE });
  }

  const input = testCase.userInput as TaskSubjectsEvalInput;

  const wrong = Object.entries(expected).flatMap(([task, subjects]) => {
    const found = resolve({ input, output: parsed, task });
    const wanted = subjects.toSorted();

    return found.join("|") === wanted.join("|")
      ? []
      : [`${task}: wanted [${wanted.join(", ")}], got [${found.join(", ")}]`];
  });

  const tasks = Object.keys(expected).length;
  const factShare = tasks === 0 ? 1 : (tasks - wrong.length) / tasks;
  const { found, total } = parsed.passageCheck;
  const passageShare = total === 0 ? 1 : found / total;

  return createFixedScore({
    conclusion: [
      `Tasks ${tasks - wrong.length}/${tasks}`,
      `passages found ${found}/${total}`,
      ...wrong,
    ].join(". "),
    score: MIN_SCORE + SCORE_RANGE * (FACT_WEIGHT * factShare + PASSAGE_WEIGHT * passageShare),
  });
};

export const findWrittenTaskSubjectsTask: Task<
  TaskSubjectsEvalInput,
  TaskSubjectsEvalOutput,
  TaskSubjectsExpected
> = {
  description:
    "Tie each written task of an exam to the subjects, parts or choice its questions are on, quoting the passage, and to none the documents don't state",
  generate: generateTaskSubjects,
  id: "find-written-task-subjects",
  name: "Find written task subjects",
  score: scoreTaskSubjects,
  testCases: TEST_CASES,
};
