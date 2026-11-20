import {
  type PlannedProduce,
  WRITING_DRILL_MINUTES,
  toProduceBlock,
} from "../../exams/essays/produce-block";
import { type PlannedBlock, type PlannedLesson } from "../session-builder";

export function pickWritingDrill({
  lesson,
  tasks,
}: {
  lesson: PlannedLesson;
  tasks: readonly (Pick<PlannedProduce, "taskKey" | "title"> & { skillIds: ReadonlySet<string> })[];
}): PlannedProduce | undefined {
  const skills = [lesson.planSkillId, ...lesson.skillIds];
  const task = tasks.find((candidate) => skills.some((id) => id && candidate.skillIds.has(id)));
  const skillId = skills.find((id) => id && task?.skillIds.has(id));

  return task && skillId
    ? {
        minutes: WRITING_DRILL_MINUTES,
        skillId,
        taskKey: task.taskKey,
        title: task.title,
        unit: "drill",
      }
    : undefined;
}

export function reserveWritingDrill(
  lesson: PlannedLesson,
  drill: PlannedProduce | undefined,
): PlannedLesson {
  return drill ? { ...lesson, drill, minutes: lesson.minutes + drill.minutes } : lesson;
}

export function addWritingDrill({
  block,
  lesson,
}: {
  block: PlannedBlock;
  lesson: PlannedLesson | undefined;
}): PlannedBlock[] {
  const drill = lesson?.drill;

  if (!drill) {
    return [block];
  }

  return [
    { ...block, estimatedMinutes: Math.max(1, block.estimatedMinutes - drill.minutes) },
    toProduceBlock(drill),
  ];
}
