import { type listWrittenTasks } from "../../../library/exams/written-tasks";

type Basis = Pick<ReturnType<typeof listWrittenTasks>[number], "grading" | "lines" | "points">;

export function getWritingTaskBasis({ grading, lines, points }: Basis): string {
  return JSON.stringify([lines, points, grading], (key, value: unknown) =>
    key === "citation" ? undefined : value,
  );
}

export function matchesWritingTaskBasis({
  prompt,
  task,
}: {
  prompt: Basis & { taskBasis?: string };
  task: Basis;
}): boolean {
  const basis = prompt.taskBasis ?? getWritingTaskBasis(prompt);
  return basis === getWritingTaskBasis(task);
}
