import "server-only";
import { type ExamPicks } from "../../exams/choices/exam-choices";
import { getEstimatedMinutes, loadWritingPace } from "../../exams/essays/_utils/load-produce";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type PlanWriting } from "../planner/writing-allocation";
import { listWrittenPapers } from "../planner/written-test-planning";

export async function loadPlanWriting({
  classTest,
  examBlueprintId,
  picks,
  skillIds,
  structure,
  userId,
}: {
  classTest: boolean;
  examBlueprintId: string;
  picks: ExamPicks;
  skillIds: ReadonlySet<string>;
  structure: ExamStructure;
  userId: string;
}): Promise<PlanWriting | undefined> {
  const practice = await loadWritingPace({
    examBlueprintId,
    picks,
    privateExam: classTest,
    structure,
    userId,
  });

  if (practice.length === 0) {
    return;
  }

  return {
    practice: practice.map(({ last: _last, ...task }) => task),
    skillIds,
    tests: listWrittenPapers({ picks, structure }).map((paper) => ({
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
