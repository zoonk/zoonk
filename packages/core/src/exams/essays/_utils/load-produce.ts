import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { MS_PER_MINUTE } from "@zoonk/utils/date";
import { loadWrittenSamples } from "../../../learner/facts/written-samples";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { type listWrittenTasks } from "../../../library/exams/written-tasks";
import { daysBetween, fromIsoDate } from "../../../plans/planner/plan-calendar";
import { type PlanGraph, parsePlanSettings } from "../../../plans/planner/plan-state";
import { planWritingScope } from "../../../plans/planner/plan-writing-scope";
import { getDaysBetweenEssays, isWrittenDay } from "../../../plans/planner/written-cadence";
import { type ExamPicks, readExamPicks } from "../../choices/exam-choices";
import { type PlannedProduce } from "../produce-block";
import { listPracticeWritingTasks } from "./practice-writing-tasks";
import { getWritingScope } from "./writing-scope";

const SHARED_CLOCK_PRACTICE_MINUTES = 45;
const CLASS_TEST_PRACTICE_MINUTES = 8;

type Task = ReturnType<typeof listWrittenTasks>[number];

export function getEstimatedMinutes({
  task,
  tasks,
  privateExam,
}: {
  task: Task;
  tasks: readonly Task[];
  privateExam: boolean;
}): number {
  if (!task.minutes || task.minutes <= 0) {
    return privateExam ? CLASS_TEST_PRACTICE_MINUTES : SHARED_CLOCK_PRACTICE_MINUTES;
  }

  const sectionTasks = tasks.filter(({ section }) => section === task.section);
  const useLines = sectionTasks.every(({ lines }) => lines !== null);
  const weight = (entry: Task) => (useLines ? (entry.lines ?? 1) : 1);
  const total = sectionTasks.reduce((sum, entry) => sum + weight(entry) * entry.count, 0);

  return Math.max(1, Math.round((task.minutes * weight(task)) / total));
}

export async function loadWritingPace({
  examBlueprintId,
  keepsTask,
  picks,
  privateExam,
  structure,
  userId,
}: {
  examBlueprintId: string;
  keepsTask?: (task: Task) => boolean;
  picks: ExamPicks;
  privateExam: boolean;
  structure: ExamStructure;
  userId: string;
}) {
  const tasks = listPracticeWritingTasks({ classTest: privateExam, structure });

  const available = tasks.filter(
    (task) => (keepsTask?.(task) ?? true) && getWritingScope({ picks, structure, task }).available,
  );

  if (available.length === 0) {
    return [];
  }

  const independent = await loadWrittenSamples({
    scope: { examBlueprintId, firstDraft: true, wholeAnswers: true },
    userId,
  });

  const byTask = Map.groupBy(independent, ({ prompt }) => prompt.taskKey);

  const ranked = available.map((task) => {
    const history = byTask.get(task.key) ?? [];

    const durations = history
      .map(({ durationMs }) => durationMs)
      .filter((duration) => duration > 0)
      .toSorted((first, second) => first - second);

    const middle = Math.floor(durations.length / 2);

    const median =
      durations.length % 2 === 0
        ? ((durations[middle - 1] ?? 0) + (durations[middle] ?? 0)) / 2
        : (durations[middle] ?? 0);

    const pacing = task.minutes ? ("estimated" as const) : ("practice" as const);

    return {
      last: history[0]?.localDate.getTime() ?? 0,
      minutes:
        median > 0
          ? Math.max(1, Math.round(median / MS_PER_MINUTE))
          : getEstimatedMinutes({ privateExam, task, tasks }),
      pacing: median > 0 ? ("personal" as const) : pacing,
      placement: independent.length === 0,
      taskKey: task.key,
      title: task.description,
      unit: "answer" as const,
    };
  });

  return ranked.toSorted(
    (first, second) => first.last - second.last || first.minutes - second.minutes,
  );
}

export async function loadSessionProduce({
  blueprint: knownBlueprint,
  goal,
  keepsTask,
  onDemand = false,
  planGraph,
  planSettings,
  taskKey,
  today,
  userId,
}: {
  blueprint?: ExamBlueprint | null;
  goal: Pick<Goal, "examBlueprintId" | "kind" | "targetDate">;
  onDemand?: boolean;
  planGraph?: PlanGraph;
  planSettings: unknown;
  taskKey?: string;
  keepsTask?: (task: Task) => boolean;
  today: Date;
  userId: string;
}): Promise<PlannedProduce | null> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const blueprint =
    knownBlueprint === undefined
      ? await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : knownBlueprint;

  if (!blueprint || (blueprint.ownerId !== userId && blueprint.visibility !== "public")) {
    return null;
  }

  const { structure } = readBlueprintContent(blueprint);
  const settings = parsePlanSettings(planSettings);

  const scope =
    planGraph &&
    planWritingScope({ graph: planGraph, skippedAreas: settings.skippedAreas, structure });

  const ordered = await loadWritingPace({
    examBlueprintId: blueprint.id,
    keepsTask: keepsTask ?? scope?.keepsTask,
    picks: readExamPicks(planSettings),
    privateExam: Boolean(blueprint.ownerId),
    structure,
    userId,
  });

  const schedule = {
    cadence: settings.writtenCadence,
    planStart: settings.startDate ? fromIsoDate(settings.startDate) : today,
    targetDate: goal.targetDate,
  };

  const latest = Math.max(0, ...ordered.map(({ last }) => last));

  if (
    !onDemand &&
    taskKey === undefined &&
    latest &&
    (!isWrittenDay({ ...schedule, date: today }) ||
      daysBetween(new Date(latest), today) < getDaysBetweenEssays(schedule))
  ) {
    return null;
  }

  const picked =
    taskKey === undefined ? ordered[0] : ordered.find((task) => task.taskKey === taskKey);

  return picked ? { ...picked, placement: picked.placement && !onDemand } : null;
}
