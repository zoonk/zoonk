import { type z } from "zod";
import { type listWrittenTasks } from "../../../library/exams/written-tasks";
import { type writingTaskSchema } from "../writing-contract";

type Task = ReturnType<typeof listWrittenTasks>[number];
type WritingTask = z.infer<typeof writingTaskSchema>;

export function indexWritingTasks(tasks: readonly Task[]): ReadonlyMap<string, WritingTask> {
  const total = tasks.reduce((sum, task) => sum + task.count, 0);
  const byKey = Map.groupBy(tasks, (task) => task.key);
  const positions = new Map<string, WritingTask>();
  const position = { number: 1 };

  for (const { count, key, lines, points } of tasks) {
    if (byKey.get(key)?.length === 1) {
      positions.set(key, { lines, number: position.number, points, total });
    }

    position.number += count;
  }

  return positions;
}
