import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { type listWrittenTasks } from "../../../library/exams/written-tasks";
import { daysBetween, fromIsoDate } from "../../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../../plans/planner/plan-state";
import { getDaysBetweenEssays, isWrittenDay } from "../../../plans/planner/written-cadence";
import { type PlannedProduce } from "../produce-block";
import { writtenAnswerSchema } from "../writing-contract";
import { listPracticeWritingTasks } from "./practice-writing-tasks";

const MS_PER_MINUTE = 60_000;
const SHARED_CLOCK_PRACTICE_MINUTES = 45;
const CLASS_TEST_PRACTICE_MINUTES = 8;

type Task = ReturnType<typeof listWrittenTasks>[number];

function getEstimatedMinutes(task: Task, tasks: Task[], privateExam: boolean): number {
  if (!task.minutes || task.minutes <= 0) {
    return privateExam ? CLASS_TEST_PRACTICE_MINUTES : SHARED_CLOCK_PRACTICE_MINUTES;
  }

  const sectionTasks = tasks.filter(({ section }) => section === task.section);
  const useLines = sectionTasks.every(({ lines }) => lines !== null);
  const weight = (entry: Task) => (useLines ? (entry.lines ?? 1) : 1);
  const total = sectionTasks.reduce((sum, entry) => sum + weight(entry) * entry.count, 0);

  return Math.max(1, Math.round((task.minutes * weight(task)) / total));
}

export async function loadSessionProduce({
  goal,
  onDemand = false,
  planSettings,
  taskKey,
  today,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "kind" | "targetDate">;
  onDemand?: boolean;
  planSettings: unknown;
  taskKey?: string;
  today: Date;
  userId: string;
}): Promise<PlannedProduce | null> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } });

  if (!blueprint || (blueprint.ownerId !== userId && blueprint.visibility !== "public")) {
    return null;
  }

  const tasks = listPracticeWritingTasks({
    classTest: Boolean(blueprint.ownerId),
    structure: readBlueprintContent(blueprint).structure,
  });

  if (tasks.length === 0) {
    return null;
  }

  const samples = await prisma.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: {
      answer: true,
      durationMs: true,
      item: { select: { content: true } },
      localDate: true,
    },
    where: {
      item: {
        content: { equals: "answer", path: ["writing", "unit"] },
        examBlueprintId: blueprint.id,
        format: "essay",
      },
      userId,
    },
  });

  const independent = samples.filter(
    ({ answer }) => writtenAnswerSchema.safeParse(answer).data?.conditions.version === "firstDraft",
  );

  const settings = parsePlanSettings(planSettings);

  const schedule = {
    cadence: settings.writtenCadence,
    planStart: settings.startDate ? fromIsoDate(settings.startDate) : today,
    targetDate: goal.targetDate,
  };

  const latest = independent[0]?.localDate;

  if (
    !onDemand &&
    taskKey === undefined &&
    latest &&
    (!isWrittenDay({ ...schedule, date: today }) ||
      daysBetween(latest, today) < getDaysBetweenEssays(schedule))
  ) {
    return null;
  }

  const ranked = tasks.map((task) => {
    const history = independent.filter(
      ({ item }) =>
        typeof item?.content === "object" &&
        item.content !== null &&
        "writing" in item.content &&
        typeof item.content.writing === "object" &&
        item.content.writing !== null &&
        "taskKey" in item.content.writing &&
        item.content.writing.taskKey === task.key,
    );

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
          : getEstimatedMinutes(task, tasks, Boolean(blueprint.ownerId)),
      pacing: median > 0 ? ("personal" as const) : pacing,
      placement: independent.length === 0 && !onDemand,
      taskKey: task.key,
      title: task.description,
      unit: "answer" as const,
    };
  });

  const ordered = ranked.toSorted(
    (first, second) => first.last - second.last || first.minutes - second.minutes,
  );

  return (
    (taskKey === undefined ? ordered[0] : ordered.find((task) => task.taskKey === taskKey)) ?? null
  );
}
