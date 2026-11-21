import "server-only";
import { getEstimatedMinutes, loadWritingPace } from "../../exams/essays/_utils/load-produce";
import { listPracticeWritingTasks } from "../../exams/essays/_utils/practice-writing-tasks";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type PlanWriting } from "../planner/writing-allocation";
import { listWrittenPapers } from "../planner/written-test-planning";

export async function loadPlanWriting({
  classTest,
  examBlueprintId,
  skillIds,
  structure,
  userId,
}: {
  classTest: boolean;
  examBlueprintId: string;
  skillIds: ReadonlySet<string>;
  structure: ExamStructure;
  userId: string;
}): Promise<PlanWriting | undefined> {
  const tasks = listPracticeWritingTasks({ classTest, structure });

  if (tasks.length === 0) {
    return;
  }

  const practice = await loadWritingPace({
    examBlueprintId,
    privateExam: classTest,
    tasks,
    userId,
  });

  return {
    practice: practice.map(({ last: _last, ...task }) => task),
    skillIds,
    tests: listWrittenPapers(structure).map((paper) => ({
      ...paper,
      tasks: paper.tasks.flatMap((task) =>
        Array.from({ length: task.count }, () => ({
          minutes: getEstimatedMinutes({ privateExam: classTest, task, tasks: paper.tasks }),
          pacing: "estimated" as const,
          taskKey: task.key,
          title: task.description,
          unit: "answer" as const,
        })),
      ),
    })),
  };
}
