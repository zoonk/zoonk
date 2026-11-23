import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { listWrittenTasks } from "../../../library/exams/written-tasks";

export function listPracticeWritingTasks({
  classTest,
  structure,
}: {
  classTest: boolean;
  structure: ExamStructure;
}): ReturnType<typeof listWrittenTasks> {
  const tasks = listWrittenTasks({ structure });

  const shortAnswer = classTest
    ? structure.formats.find(({ kind }) => kind === "shortAnswer")
    : null;

  if (tasks.length > 0 || !shortAnswer) {
    return tasks;
  }

  return [
    {
      count: 1,
      description: shortAnswer.description,
      grading: { criteria: [], kind: "levels", language: null, rounding: null, zeroing: [] },
      handwritten: null,
      key: "class-short-answer",
      lines: null,
      minutes: null,
      points: null,
      section: shortAnswer.sections?.[0] ?? shortAnswer.description,
      session: null,
      subjects: null,
    },
  ];
}
